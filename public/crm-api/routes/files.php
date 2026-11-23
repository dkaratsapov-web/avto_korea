<?php
/**
 * Вложения по сделке: фото авто, инвойсы, договоры, таможенные документы.
 *
 * Содержимое лежит прямо в базе. У бизнеса это десятки файлов на сделку, а не
 * терабайты, зато нет зависимости от внешнего хранилища и лишних ключей —
 * а значит, и лишних действий от владельца при запуске. Если объём вырастет,
 * поле content меняется на ссылку в хранилище без правок интерфейса.
 */

declare(strict_types=1);

/** Восемь мегабайт: инвойс и фото с телефона проходят, видео — нет. */
const CRM_FILE_MAX_BYTES = 8 * 1024 * 1024;

/** Больше шестидесяти вложений на сделку — признак, что что-то пошло не так. */
const CRM_FILES_PER_DEAL = 60;

/**
 * Неприкосновенный запас места на диске.
 *
 * CRM и сайт живут на одном хостинге и делят одну квоту — это единственное,
 * что у них общее. Вложения растут быстрее всего остального: фото с телефона
 * лежат в базе как есть, тридцать снимков на сделку — обычное дело.
 *
 * Если диск заполнить до конца, первым сломается не CRM, а САЙТ: обработчик
 * заявок (public/api/lead.php) не сможет дописать заявку в журнал и вернёт
 * посетителю ошибку — то есть оплаченный клик превратится в потерянную заявку.
 * Поэтому загрузка останавливается заранее, оставляя сайту место для работы.
 */
const CRM_DISK_RESERVE_BYTES = 300 * 1024 * 1024;

/**
 * Хватит ли места, чтобы принять файл и не тронуть резерв.
 *
 * Если хостинг не отдаёт размер свободного места, разрешаем: отказывать
 * из-за неизвестности хуже, чем принять файл.
 */
function crm_has_disk_room(int $incoming): bool
{
    $free = @disk_free_space(CRM_DATA_DIR);
    if ($free === false) {
        return true;
    }

    // Место нужно дважды: под запись в базу и под временный файл при вставке.
    return (float) $free - ($incoming * 2) > CRM_DISK_RESERVE_BYTES;
}

/** Белый список типов. Всё, что умеет исполняться, сюда не попадает. */
const CRM_FILE_MIME = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
];

function crm_route_files(string $method, array $path): void
{
    $id = $path[0] ?? '';

    if ($id === '' && $method === 'POST') {
        $user = crm_require_user();
        crm_files_upload($user);
    }

    if ($id !== '' && $method === 'GET') {
        crm_require_user();
        crm_files_download($id);
    }

    if ($id !== '' && $method === 'DELETE') {
        $user = crm_require_user();
        // Берём только метаданные: содержимое файла для удаления не нужно,
        // а тянуть из базы несколько мегабайт ради имени — расточительство.
        $file = crm_one('SELECT id, deal_id, name FROM crm_files WHERE id = ?', [$id]);
        if ($file === null) {
            crm_fail(404, 'not_found', 'Файл не найден');
        }

        crm_exec('DELETE FROM crm_files WHERE id = ?', [$id]);
        @unlink(CRM_DATA_DIR . '/thumbs/' . preg_replace('/[^0-9a-f]/', '', (string) $file['id']) . '.jpg');
        crm_log_event((string) $file['deal_id'], (string) $user['id'], 'FILE_DELETED', (string) $file['name']);

        crm_json(['ok' => true, 'events' => crm_deal_events((string) $file['deal_id'])]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела файлов');
}

/**
 * Приём файла. Идёт обычной формой multipart, а не JSON с base64: так файл
 * не раздувается на треть и не упирается в лимит тела запроса.
 */
function crm_files_upload(array $user): void
{
    $dealId = isset($_POST['dealId']) ? mb_substr(trim((string) $_POST['dealId']), 0, 64) : '';
    if (crm_one('SELECT id FROM crm_deals WHERE id = ?', [$dealId]) === null) {
        crm_fail(404, 'deal_not_found', 'Сделка не найдена');
    }

    $kind = isset($_POST['kind']) ? (string) $_POST['kind'] : 'OTHER';
    if (!in_array($kind, CRM_FILE_KINDS, true)) {
        $kind = 'OTHER';
    }

    $upload = $_FILES['file'] ?? null;
    if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        // Превышение post_max_size приходит сюда же, но с пустым $_FILES,
        // поэтому текст ошибки объясняет обе ситуации сразу.
        crm_fail(422, 'no_file', 'Файл не получен — возможно, он больше 8 МБ');
    }

    $size = (int) ($upload['size'] ?? 0);
    if ($size <= 0) {
        crm_fail(422, 'empty_file', 'Файл пустой');
    }
    if ($size > CRM_FILE_MAX_BYTES) {
        crm_fail(413, 'file_too_large', 'Файл больше 8 МБ');
    }

    $count = crm_one('SELECT COUNT(*) AS n FROM crm_files WHERE deal_id = ?', [$dealId]);
    if ((int) ($count['n'] ?? 0) >= CRM_FILES_PER_DEAL) {
        crm_fail(422, 'too_many_files', 'К сделке уже прикреплено максимум файлов');
    }

    // Тип определяем сами по содержимому: заголовок из браузера подделывается.
    $mime = 'application/octet-stream';
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detected = $finfo->file((string) $upload['tmp_name']);
        if (is_string($detected) && $detected !== '') {
            $mime = $detected;
        }
    }
    if (!in_array($mime, CRM_FILE_MIME, true)) {
        crm_fail(422, 'bad_type', 'Такой тип файла загрузить нельзя');
    }

    if (!crm_has_disk_room($size)) {
        crm_fail(
            507,
            'no_disk_space',
            'На хостинге кончается место — файл не сохранён. Удалите лишние вложения или расширьте тариф',
        );
    }

    $content = @file_get_contents((string) $upload['tmp_name']);
    if ($content === false) {
        crm_fail(500, 'read_failed', 'Не удалось прочитать файл');
    }

    $name = crm_safe_file_name((string) ($upload['name'] ?? 'file'));

    $stmt = crm_db()->prepare(
        'INSERT INTO crm_files (id, deal_id, uploaded_by, name, mime_type, size, kind, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->bindValue(1, crm_id());
    $stmt->bindValue(2, $dealId);
    $stmt->bindValue(3, $user['id']);
    $stmt->bindValue(4, $name);
    $stmt->bindValue(5, $mime);
    $stmt->bindValue(6, $size, PDO::PARAM_INT);
    $stmt->bindValue(7, $kind);
    // Двоичные данные обязаны идти как LOB, иначе драйвер испортит их
    // на первом же нулевом байте.
    $stmt->bindValue(8, $content, PDO::PARAM_LOB);
    $stmt->bindValue(9, crm_now());
    $stmt->execute();

    crm_log_event($dealId, (string) $user['id'], 'FILE_ADDED', $name, null, $kind);

    crm_json([
        'ok' => true,
        'files' => crm_deal_files($dealId),
        'events' => crm_deal_events($dealId),
    ]);
}

/**
 * Имя файла для показа и скачивания.
 *
 * Браузеры присылают имя в UTF-8, но на пути через формы оно иногда приходит
 * побайтно — тогда «Договор.pdf» превращается в мусор. Некорректную кодировку
 * распознаём и не сохраняем: лучше «file.pdf», чем нечитаемая строка.
 */
function crm_safe_file_name(string $raw): string
{
    $name = basename(str_replace('\\', '/', $raw));
    $name = str_replace(["\0", "\r", "\n"], '', $name);

    if (!mb_check_encoding($name, 'UTF-8')) {
        $converted = @mb_convert_encoding($name, 'UTF-8', 'Windows-1251');
        $name = is_string($converted) && mb_check_encoding($converted, 'UTF-8') ? $converted : 'file';
    }

    $name = trim($name);
    return $name === '' ? 'file' : mb_substr($name, 0, 200);
}

function crm_files_download(string $id): void
{
    $row = crm_one('SELECT * FROM crm_files WHERE id = ?', [$id]);
    if ($row === null) {
        crm_fail(404, 'not_found', 'Файл не найден');
    }

    crm_serve_file_row($row, ($_GET['thumb'] ?? '') === '1');
}

/**
 * Отдаёт вложение: полностью или миниатюрой.
 *
 * Миниатюра нужна не для красоты. В карточке сделки бывает три десятка фото
 * с телефона по несколько мегабайт: без уменьшения каждое открытие страницы
 * тянуло бы сотню мегабайт, причём заново — вложения запрещены к кэшированию
 * во всех промежуточных узлах.
 */
function crm_serve_file_row(array $row, bool $thumb): never
{
    $mime = (string) $row['mime_type'];

    if ($thumb) {
        $small = crm_thumbnail((string) $row['id'], $mime, fn() => crm_file_content($row));
        if ($small !== null) {
            crm_send_file($small, 'image/jpeg', 'thumb.jpg', true);
        }
        // Миниатюру сделать не удалось (не картинка, нет GD, формат вроде
        // HEIC) — отдаём оригинал: пусть лучше будет тяжело, чем пусто.
    }

    crm_send_file(
        crm_file_content($row),
        $mime,
        (string) $row['name'],
        // Картинки и PDF показываем как есть, остальное — скачиванием.
        str_starts_with($mime, 'image/') || $mime === 'application/pdf',
    );
}

/** Содержимое вложения. SQLite отдаёт двоичные поля потоком. */
function crm_file_content(array $row): string
{
    $content = $row['content'];
    return is_resource($content) ? (string) stream_get_contents($content) : (string) $content;
}

/** Максимальная сторона миниатюры. Хватает и сетке превью, и ретине. */
const CRM_THUMB_MAX = 640;

/**
 * Миниатюра в JPEG или null, если сделать её нельзя.
 *
 * Готовая миниатюра кладётся рядом с базой и переиспользуется: пересжимать
 * одно и то же фото на каждый показ на общем хостинге слишком дорого.
 * Содержимое оригинала читается только при промахе кэша — поэтому оно
 * передаётся замыканием, а не значением.
 */
function crm_thumbnail(string $id, string $mime, callable $source): ?string
{
    static $supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!in_array($mime, $supported, true) || !function_exists('imagecreatefromstring')) {
        return null;
    }

    $dir = CRM_DATA_DIR . '/thumbs';
    $path = $dir . '/' . preg_replace('/[^0-9a-f]/', '', $id) . '.jpg';

    if (is_file($path)) {
        $cached = @file_get_contents($path);
        if ($cached !== false && $cached !== '') {
            return $cached;
        }
    }

    $image = @imagecreatefromstring($source());
    if ($image === false) {
        return null;
    }

    $width = imagesx($image);
    $height = imagesy($image);
    $scale = min(1, CRM_THUMB_MAX / max($width, $height));
    $targetWidth = max(1, (int) round($width * $scale));
    $targetHeight = max(1, (int) round($height * $scale));

    $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
    // JPEG не умеет прозрачность: подкладываем белое, иначе прозрачные
    // области PNG станут чёрными.
    imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
    imagecopyresampled($canvas, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
    imagedestroy($image);

    ob_start();
    imagejpeg($canvas, null, 78);
    $jpeg = (string) ob_get_clean();
    imagedestroy($canvas);

    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    @file_put_contents($path, $jpeg, LOCK_EX);

    return $jpeg;
}

/** Отдаёт файл с заголовками, при которых он не выполнится как страница. */
function crm_send_file(string $content, string $mime, string $name, bool $inline): never
{
    $disposition = $inline ? 'inline' : 'attachment';
    $fallback = preg_replace('/[^A-Za-z0-9._-]/', '_', $name) ?: 'file';

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($content));
    header('X-Content-Type-Options: nosniff');
    // Содержимое вложения к своему адресу привязано навсегда — новый файл
    // получает новый идентификатор. Поэтому кэшировать можно надолго, но
    // только в браузере владельца: private не пускает файл в общие кэши.
    header('Cache-Control: private, max-age=604800, immutable');
    header(sprintf(
        "Content-Disposition: %s; filename=\"%s\"; filename*=UTF-8''%s",
        $disposition,
        $fallback,
        rawurlencode($name),
    ));
    echo $content;
    exit;
}
