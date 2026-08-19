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
        crm_require_user();
        if (crm_one('SELECT id FROM crm_files WHERE id = ?', [$id]) === null) {
            crm_fail(404, 'not_found', 'Файл не найден');
        }
        crm_exec('DELETE FROM crm_files WHERE id = ?', [$id]);
        crm_json(['ok' => true]);
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

    crm_json(['ok' => true, 'files' => crm_deal_files($dealId)]);
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

    $content = $row['content'];
    // SQLite отдаёт двоичные поля потоком — читаем его целиком.
    if (is_resource($content)) {
        $content = stream_get_contents($content);
    }

    crm_send_file(
        (string) $content,
        (string) $row['mime_type'],
        (string) $row['name'],
        // Картинки и PDF показываем прямо в браузере, остальное — скачиванием.
        str_starts_with((string) $row['mime_type'], 'image/') || $row['mime_type'] === 'application/pdf',
    );
}

/** Отдаёт файл с заголовками, при которых он не выполнится как страница. */
function crm_send_file(string $content, string $mime, string $name, bool $inline): never
{
    $disposition = $inline ? 'inline' : 'attachment';
    $fallback = preg_replace('/[^A-Za-z0-9._-]/', '_', $name) ?: 'file';

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($content));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, private');
    header(sprintf(
        "Content-Disposition: %s; filename=\"%s\"; filename*=UTF-8''%s",
        $disposition,
        $fallback,
        rawurlencode($name),
    ));
    echo $content;
    exit;
}
