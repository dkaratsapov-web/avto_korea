<?php
/**
 * Проверка резервных копий CRM — на настоящей базе.
 *
 * Копию проверяют один раз в жизни, и всегда в худший день. Поэтому здесь не
 * «вызывается ли функция», а полный круг: завести записи, снять копию,
 * испортить базу так, как её портит настоящая ошибка, восстановить — и
 * убедиться, что вернулось именно то, что было.
 *
 * Отдельно проверяется то, ради чего вся эта возня и затевалась: вложения
 * сделок в копию не входят (иначе она весила бы сотни мегабайт), но
 * восстановление не должно их за собой уносить.
 *
 * Запуск: php scripts/check-backup.php
 */

declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/crm-backup-check-' . bin2hex(random_bytes(4));
@mkdir($tmp, 0700, true);

/*
 * Подменяем каталог данных до подключения boot.php: там все определения
 * стоят под проверкой «если ещё не объявлено», и это единственный шов,
 * позволяющий прогнать настоящий код на временной базе.
 */
define('CRM_BOOTED', true);
define('CRM_DATA_DIR', $tmp);
define('CRM_DB_FILE', $tmp . '/crm.sqlite');
define('CRM_KEY_FILE', $tmp . '/session.key');
define('CRM_CONFIG_FILE', $tmp . '/config.php');
define('CRM_COOKIE', 'crm_session');
define('CRM_SESSION_TTL', 3600);
mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');

require_once __DIR__ . '/../public/crm-api/lib/backup.php';

$failures = [];

function check(string $what, bool $ok, string $detail = ''): void
{
    global $failures;
    if (!$ok) {
        $failures[] = $what . ($detail !== '' ? ": {$detail}" : '');
    }
}

function cleanup(string $dir): void
{
    foreach (glob($dir . '/*') ?: [] as $path) {
        is_dir($path) ? cleanup($path) : @unlink($path);
    }
    @rmdir($dir);
}

if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    fwrite(STDERR, "Копии: пропущено — в этом PHP нет pdo_sqlite\n");
    cleanup($tmp);
    exit(0);
}

// --- заводим записи ---

$now = crm_now();
crm_exec(
    'INSERT INTO crm_users (id, email, name, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    ['u1', 'owner@example.com', 'Владелец', 'hash', 'OWNER', $now, $now],
);
crm_exec(
    'INSERT INTO crm_deals (id, number, stage, manager_id, client_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['d1', 1, 'NEW', 'u1', 'Пётр', $now, $now],
);
crm_exec(
    'INSERT INTO crm_deals (id, number, stage, manager_id, client_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['d2', 2, 'NEW', 'u1', 'Мария', $now, $now],
);
crm_exec(
    'INSERT INTO crm_tasks (id, deal_id, assignee_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)',
    ['t1', 'd1', 'u1', 'Позвонить', $now, $now],
);
crm_exec(
    'INSERT INTO crm_files (id, deal_id, name, mime_type, size, kind, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['f1', 'd1', 'фото.jpg', 'image/jpeg', 5, 'PHOTO', 'JPEGD', $now],
);

// --- снимок ---

$made = crm_backup_make('проверка');
$path = crm_backup_path($made['name']);
check('копия не создалась', $path !== null, $made['name']);
check('в копии нет сделок', $made['deals'] === 2, (string) $made['deals']);

$dump = crm_backup_read((string) $path);
check('в копии нет таблицы сделок', isset($dump['tables']['crm_deals']));
check('в копии не те сделки', count($dump['tables']['crm_deals']) === 2);

/*
 * Тело вложения в копию попадать не должно: одна фотография — мегабайты,
 * а копия снимается ежедневно и уходит в мессенджер, который больше 50 МБ
 * не примет.
 */
$fileRow = $dump['tables']['crm_files'][0] ?? [];
check('тело вложения утекло в копию', !array_key_exists('content', $fileRow), implode(',', array_keys($fileRow)));
check('запись о вложении в копию не попала', ($fileRow['id'] ?? '') === 'f1');

// --- портим базу так, как её портит ошибка ---

crm_exec('UPDATE crm_deals SET client_name = ? WHERE id = ?', ['Затёрто', 'd1']);
crm_exec('DELETE FROM crm_tasks');
crm_exec('DELETE FROM crm_deals WHERE id = ?', ['d2']);

// --- восстановление ---

$report = crm_backup_restore($made['name']);

$deal = crm_one('SELECT client_name FROM crm_deals WHERE id = ?', ['d1']);
check('имя клиента не восстановилось', ($deal['client_name'] ?? '') === 'Пётр', (string) ($deal['client_name'] ?? ''));

$deals = crm_all('SELECT id FROM crm_deals ORDER BY id');
check('удалённая сделка не вернулась', count($deals) === 2, (string) count($deals));

$tasks = crm_all('SELECT id FROM crm_tasks');
check('задачи не вернулись', count($tasks) === 1, (string) count($tasks));

/*
 * Главное. Вложение в копии не хранится — значит восстановление обязано
 * оставить его на месте, а не «вернуть базу к состоянию копии» вместе с
 * очисткой файлов. Иначе восстановление вчерашней копии стирало бы все
 * фотографии, загруженные сегодня.
 */
$file = crm_one('SELECT content FROM crm_files WHERE id = ?', ['f1']);
check('вложение потерялось при восстановлении', ($file['content'] ?? '') === 'JPEGD');

// Страховочная копия снимается до восстановления — иначе ошибка «не та копия»
// была бы необратимой.
check('страховочная копия не снята', crm_backup_path($report['safety']) !== null, (string) $report['safety']);
check('копий на диске не две', count(crm_backup_list()) === 2, (string) count(crm_backup_list()));

// --- вложение без своей сделки ---

// Внешние ключи такую строку не пропустят — а в базе она однажды заведётся
// после сбоя посреди удаления сделки. Ради проверки заводим её насильно.
crm_db()->exec('PRAGMA foreign_keys = OFF');
crm_exec(
    'INSERT INTO crm_files (id, deal_id, name, mime_type, size, kind, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['f2', 'нет-такой-сделки', 'мусор.jpg', 'image/jpeg', 3, 'PHOTO', 'XXX', $now],
);
crm_db()->exec('PRAGMA foreign_keys = ON');
crm_backup_restore($made['name']);
check(
    'вложение без сделки осталось в базе',
    crm_one('SELECT id FROM crm_files WHERE id = ?', ['f2']) === null,
);

// --- имя файла: чужое сюда попадать не должно ---

foreach (['../../crm.sqlite', 'crm-2026.json.gz', '/etc/passwd', 'crm-20260101-000000.json'] as $bad) {
    check('опасное имя копии принято', crm_backup_path($bad) === null, $bad);
}

// --- две копии в одну секунду не затирают друг друга ---

$a = crm_backup_make('первая');
$b = crm_backup_make('вторая');
check('вторая копия затёрла первую', $a['name'] !== $b['name'], $a['name']);
check('первая копия исчезла', crm_backup_path($a['name']) !== null);

// --- лишние копии подчищаются ---

for ($i = 0; $i < CRM_BACKUP_KEEP + 5; $i++) {
    @file_put_contents(crm_backup_dir() . '/crm-2020' . sprintf('%04d', $i) . '-000000.json.gz', 'x');
}
crm_backup_prune();
check(
    'старые копии не подчищаются',
    count(crm_backup_list()) === CRM_BACKUP_KEEP,
    (string) count(crm_backup_list()),
);
// Подчищаются именно старые: свежая копия должна пережить уборку.
check('уборка унесла свежую копию', crm_backup_path($b['name']) !== null);

// --- итог ---

cleanup($tmp);

if ($failures) {
    fwrite(STDERR, "Копии CRM: найдены проблемы\n");
    foreach ($failures as $f) {
        fwrite(STDERR, "  • {$f}\n");
    }
    exit(1);
}

echo "Копии CRM: снимок, восстановление и уборка проверены\n";
