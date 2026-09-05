<?php
/**
 * Резервные копии записей CRM.
 *
 * Здесь лежит всё, что нельзя восстановить по памяти: сделки, расчёты, история
 * переписки по каждой машине, задачи, сотрудники, реквизиты. База — один файл
 * на общем хостинге. Он переживает выкладку сайта (лежит выше каталога сайта),
 * но не переживёт ни сбоя диска, ни собственной ошибки в коде, которая однажды
 * сотрёт лишнее. Копия нужна именно на этот случай.
 *
 * Устройство сознательно простое, без хостинговых кронов и сторонних хранилищ.
 *
 *  • Раз в сутки, попутно с обычным запросом, снимается снимок записей в JSON
 *    и кладётся рядом с базой в backups/. Работа идёт ПОСЛЕ ответа браузеру,
 *    поэтому никто её не ждёт.
 *  • Тот же файл уходит владельцу в Telegram. Копия на том же диске спасает
 *    от ошибки в коде, но не от гибели диска — второй экземпляр должен лежать
 *    в другом месте, и мессенджер здесь самое дешёвое «другое место».
 *  • Старые копии подчищаются, чтобы не съесть место на хостинге.
 *
 * Вложения (фото и документы сделок) в снимок не входят: они лежат в базе
 * двоичными полями и весят мегабайты. Снимок из-за них раздулся бы до размера,
 * который Telegram не примет, а суточная копия перестала бы быть дешёвой.
 * Для вложений есть отдельная выгрузка всей базы файлом.
 */

declare(strict_types=1);

require_once __DIR__ . '/boot.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/model.php';

/** Раз в сколько секунд снимается суточная копия. */
const CRM_BACKUP_EVERY = 24 * 3600;

/** Сколько копий держим на диске. */
const CRM_BACKUP_KEEP = 30;

/**
 * Таблицы, попадающие в снимок, в порядке восстановления.
 *
 * Сессий и подписок на push здесь нет намеренно: это живые пропуска
 * сегодняшних браузеров. В копии месячной давности они бесполезны, а
 * восстановление вернуло бы к жизни давно закрытые входы.
 */
const CRM_BACKUP_TABLES = ['crm_users', 'crm_settings', 'crm_deals', 'crm_events', 'crm_tasks', 'crm_files'];

/** Поле, которое в снимок не переносится: тело вложения. */
const CRM_BACKUP_SKIP = ['crm_files' => ['content']];

function crm_backup_dir(): string
{
    $dir = CRM_DATA_DIR . '/backups';
    if (!is_dir($dir)) {
        crm_ensure_data_dir();
        @mkdir($dir, 0700, true);
        // Каталог данных и так недоступен по HTTP, но копии — тот файл,
        // который меньше всего хочется отдать наружу по чужой ошибке.
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return $dir;
}

/**
 * Имя файла копии по времени: копии сортируются по имени как по дате.
 *
 * Точность — секунда, а две копии подряд бывают в одну секунду (например,
 * страховочная перед восстановлением). Поэтому занятое имя дополняется
 * номером: иначе вторая копия молча затирала бы первую.
 */
function crm_backup_name(): string
{
    $base = 'crm-' . gmdate('Ymd-His');
    $name = $base . '.json.gz';
    for ($i = 2; is_file(crm_backup_dir() . '/' . $name) && $i < 100; $i++) {
        $name = $base . '-' . $i . '.json.gz';
    }
    return $name;
}

/** Копии на диске, новые сверху. */
function crm_backup_list(): array
{
    $files = glob(crm_backup_dir() . '/crm-*.json.gz') ?: [];
    rsort($files, SORT_STRING);

    return array_values(array_map(static fn($path) => [
        'name' => basename($path),
        'size' => (int) @filesize($path),
        'createdAt' => gmdate('Y-m-d\TH:i:s\Z', (int) @filemtime($path)),
    ], $files));
}

/** Полный путь копии по имени. Защита от «../» — имя проверяется по шаблону. */
function crm_backup_path(string $name): ?string
{
    if (!preg_match('/^crm-\d{8}-\d{6}(-\d{1,2})?\.json\.gz$/', $name)) {
        return null;
    }
    $path = crm_backup_dir() . '/' . $name;
    return is_file($path) ? $path : null;
}

/**
 * Снимок записей.
 *
 * Читаем таблицы как есть, без разбора смысла: снимок должен пережить любые
 * будущие поля. По той же причине при восстановлении колонки сверяются с
 * настоящей схемой, а не с той, что была в день снятия копии.
 */
function crm_backup_make(string $reason = ''): array
{
    $dump = [
        'format' => 1,
        'createdAt' => crm_now(),
        'reason' => $reason,
        'filesWithoutContent' => true,
        'tables' => [],
    ];

    foreach (CRM_BACKUP_TABLES as $table) {
        $skip = CRM_BACKUP_SKIP[$table] ?? [];
        // Колонки перечисляем поимённо, а не через «*»: иначе тела вложений
        // сначала целиком поднялись бы в память, и снимок клал бы хостинг
        // ровно на том, чего мы в него не кладём.
        $columns = array_values(array_diff(crm_backup_columns($table), $skip));
        if ($columns === []) {
            continue;
        }
        $dump['tables'][$table] = crm_all(
            'SELECT ' . implode(', ', $columns) . ' FROM ' . $table,
        );
    }

    $json = json_encode($dump, JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        throw new RuntimeException('не удалось собрать снимок');
    }

    $payload = function_exists('gzencode') ? gzencode($json, 6) : $json;
    $name = crm_backup_name();
    $path = crm_backup_dir() . '/' . $name;
    if (@file_put_contents($path, $payload, LOCK_EX) === false) {
        throw new RuntimeException('не удалось записать копию');
    }

    crm_backup_prune();

    return [
        'name' => $name,
        'size' => (int) @filesize($path),
        'createdAt' => $dump['createdAt'],
        'deals' => count($dump['tables']['crm_deals'] ?? []),
    ];
}

/** Убирает лишние копии, оставляя последние CRM_BACKUP_KEEP. */
function crm_backup_prune(): void
{
    $files = glob(crm_backup_dir() . '/crm-*.json.gz') ?: [];
    if (count($files) <= CRM_BACKUP_KEEP) {
        return;
    }
    rsort($files, SORT_STRING);
    foreach (array_slice($files, CRM_BACKUP_KEEP) as $old) {
        @unlink($old);
    }
}

function crm_backup_remove(string $name): bool
{
    $path = crm_backup_path($name);
    return $path !== null && @unlink($path);
}

/** Разбор файла копии. */
function crm_backup_read(string $path): array
{
    $raw = @file_get_contents($path);
    if (!is_string($raw)) {
        throw new RuntimeException('копия не читается');
    }
    // Файл может быть и несжатым: gzencode есть не на каждом хостинге.
    if (str_starts_with($raw, "\x1f\x8b") && function_exists('gzdecode')) {
        $raw = (string) gzdecode($raw);
    }
    $dump = json_decode($raw, true);
    if (!is_array($dump) || !isset($dump['tables']) || !is_array($dump['tables'])) {
        throw new RuntimeException('файл не похож на копию CRM');
    }
    return $dump;
}

/**
 * Восстановление записей из копии.
 *
 * Что происходит с вложениями. В копии их тел нет, поэтому таблица файлов не
 * очищается: тела, которые ещё лежат в базе, остаются на месте. После
 * восстановления удаляются только те записи о файлах, чья сделка не вернулась.
 * Так копия недельной давности не уносит с собой фотографии, загруженные вчера
 * по сделкам, которые в ней есть.
 *
 * Внешние ключи на время работы выключаются: очистка сделок иначе унесла бы
 * каскадом и вложения — ровно то, что мы бережём.
 */
function crm_backup_restore(string $name): array
{
    $path = crm_backup_path($name);
    if ($path === null) {
        throw new RuntimeException('копия не найдена');
    }
    $dump = crm_backup_read($path);

    $pdo = crm_db();
    $mysql = (crm_config()['driver'] ?? 'sqlite') === 'mysql';

    // Страховка: то, что сейчас в базе, тоже становится копией. Восстановление
    // из не той копии — обычная ошибка уставшего человека, и она не должна
    // быть необратимой.
    $safety = crm_backup_make('перед восстановлением ' . $name);

    if ($mysql) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    } else {
        $pdo->exec('PRAGMA foreign_keys = OFF');
    }

    $restored = [];
    $pdo->beginTransaction();
    try {
        foreach (CRM_BACKUP_TABLES as $table) {
            $rows = $dump['tables'][$table] ?? null;
            if (!is_array($rows)) {
                continue;
            }

            // Колонки берём из живой схемы: копия могла быть снята до того,
            // как в таблице появилось новое поле, и наоборот.
            $columns = crm_backup_columns($table);

            if ($table !== 'crm_files') {
                $pdo->exec('DELETE FROM ' . $table);
            }

            $inserted = 0;
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                // Записи о файлах не вставляем: без тела вложения такая
                // строка была бы ссылкой в пустоту.
                if ($table === 'crm_files') {
                    continue;
                }
                $values = [];
                foreach ($columns as $column) {
                    if (array_key_exists($column, $row)) {
                        $values[$column] = $row[$column];
                    }
                }
                if ($values === []) {
                    continue;
                }
                $names = array_keys($values);
                $pdo->prepare(
                    'INSERT INTO ' . $table . ' (' . implode(', ', $names) . ') VALUES ('
                    . implode(', ', array_fill(0, count($names), '?')) . ')',
                )->execute(array_values($values));
                $inserted++;
            }
            $restored[$table] = $inserted;
        }

        // Вложения без вернувшейся сделки — мусор: показать их всё равно негде.
        $pdo->exec(
            'DELETE FROM crm_files WHERE deal_id NOT IN (SELECT id FROM crm_deals)',
        );

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    } finally {
        if ($mysql) {
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        } else {
            $pdo->exec('PRAGMA foreign_keys = ON');
        }
    }

    return ['restored' => $restored, 'safety' => $safety['name']];
}

/** Список колонок таблицы в текущей схеме. */
function crm_backup_columns(string $table): array
{
    $pdo = crm_db();
    $mysql = (crm_config()['driver'] ?? 'sqlite') === 'mysql';

    if ($mysql) {
        $rows = $pdo->query('SHOW COLUMNS FROM ' . $table)->fetchAll();
        return array_map(static fn($r) => (string) ($r['Field'] ?? ''), $rows);
    }

    $rows = $pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll();
    return array_map(static fn($r) => (string) ($r['name'] ?? ''), $rows);
}

/* ------------------------------------------------------ суточная копия */

/**
 * Проверка «не пора ли», вызываемая на завершении запроса.
 *
 * Никаких кронов: на общем хостинге их либо нет, либо их настройка — то
 * самое действие, которое владелец однажды забудет сделать. Раз в сутки
 * копию снимает первый же запрос, пришедший после того, как сутки истекли.
 *
 * Работа идёт после ответа браузеру, поэтому её никто не ждёт. Замок не даёт
 * двум одновременным запросам снять две копии.
 */
function crm_backup_tick(): void
{
    try {
        if (!is_dir(CRM_DATA_DIR)) {
            return;
        }
        // Если запрос до базы так и не дошёл (не тот адрес, вход без пароля,
        // упавшее подключение), то и снимать нечего — а попытка открыть базу
        // здесь, после отданного ответа, могла бы дописать в него свою ошибку.
        if (!crm_db_connected()) {
            return;
        }

        $list = crm_backup_list();
        $last = $list[0] ?? null;
        if ($last !== null && strtotime($last['createdAt']) > time() - CRM_BACKUP_EVERY) {
            return;
        }

        $lockPath = crm_backup_dir() . '/.lock';
        $lock = @fopen($lockPath, 'c');
        if ($lock === false) {
            return;
        }
        if (!flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            return;
        }

        try {
            $made = crm_backup_make('суточная');
            crm_backup_send($made['name']);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    } catch (Throwable $e) {
        // Копия — дело служебное: её сбой не должен ронять запрос, который
        // человек уже считает выполненным. Но и молчать о нём нельзя.
        crm_notify_log('backup: ' . $e->getMessage());
    }
}

/**
 * Отправка копии владельцу в Telegram.
 *
 * Второй экземпляр обязан лежать не на этом диске. Канал уже настроен для
 * уведомлений, и другого бесплатного «другого места» у общего хостинга нет.
 *
 * В файле есть хэши паролей сотрудников и токен бота — то есть попадать он
 * должен ровно туда, где и так есть доступ к боту: в личную переписку
 * владельца с ним. Никому больше копия не уходит.
 */
function crm_backup_send(string $name): bool
{
    require_once __DIR__ . '/notify.php';

    $path = crm_backup_path($name);
    if ($path === null || crm_telegram_token() === '' || !function_exists('curl_init')) {
        return false;
    }
    if ((crm_settings()['backupToTelegram'] ?? true) === false) {
        return false;
    }

    $owners = crm_all(
        "SELECT telegram_chat_id FROM crm_users WHERE role = 'OWNER' AND telegram_chat_id IS NOT NULL AND telegram_chat_id <> ''",
    );
    if ($owners === []) {
        return false;
    }

    $caption = 'Копия записей CRM от ' . gmdate('d.m.Y H:i', (int) @filemtime($path)) . ' UTC'
        . "\nВложения сделок в копию не входят.";

    $sent = false;
    foreach ($owners as $owner) {
        $ch = curl_init('https://api.telegram.org/bot' . crm_telegram_token() . '/sendDocument');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => [
                'chat_id' => (string) $owner['telegram_chat_id'],
                'caption' => $caption,
                'document' => new CURLFile($path, 'application/gzip', $name),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_CONNECTTIMEOUT => 6,
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = is_string($response) ? json_decode($response, true) : null;
        if (is_array($data) && ($data['ok'] ?? false) === true) {
            $sent = true;
        } else {
            crm_notify_log('backup: не ушла копия в Telegram — ' . (is_array($data)
                ? (string) ($data['description'] ?? 'отказ')
                : 'нет ответа'));
        }
    }

    return $sent;
}
