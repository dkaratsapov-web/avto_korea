<?php
/**
 * Кэш фотографий и видео из Telegram на российском хостинге.
 *
 * Раньше каждая картинка каталога грузилась в браузер прямо с воркера
 * (*.workers.dev), который в России блокируется. Теперь файл один раз
 * забирается сервером, кладётся на диск и дальше отдаётся с этого же сайта:
 * посетитель ничего не тянет из Cloudflare, а каталог открывается быстрее.
 *
 * Маршруты (см. .htaccess): /api/tgphoto?id=..., /api/tgvideo?id=...
 */

declare(strict_types=1);

const WORKER = 'https://diauto-bot.d-karatsapov.workers.dev';
const MEDIA_DIR = __DIR__ . '/../../private-media';

$id = (string) ($_GET['id'] ?? '');
$isVideo = isset($_GET['video']);

// file_id Telegram — только латиница, цифры, дефис, подчёркивание.
if ($id === '' || !preg_match('/^[A-Za-z0-9_\-]{10,300}$/', $id)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'bad id';
    exit;
}

if (!is_dir(MEDIA_DIR)) {
    @mkdir(MEDIA_DIR, 0700, true);
}

$key = ($isVideo ? 'v_' : 'p_') . hash('sha256', $id);
$file = MEDIA_DIR . '/' . $key;
$metaFile = $file . '.type';

function serveFile(string $file, string $metaFile, bool $isVideo): never
{
    $type = is_file($metaFile)
        ? (string) file_get_contents($metaFile)
        : ($isVideo ? 'video/mp4' : 'image/jpeg');
    header('Content-Type: ' . $type);
    header('Content-Length: ' . (string) filesize($file));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Accept-Ranges: bytes');
    readfile($file);
    exit;
}

if (is_file($file) && filesize($file) > 0) {
    serveFile($file, $metaFile, $isVideo);
}

// Файла ещё нет — забираем у воркера.
$url = WORKER . ($isVideo ? '/api/tgvideo?id=' : '/api/tgphoto?id=') . rawurlencode($id);

$tmp = $file . '.part';
$fh = @fopen($tmp, 'wb');
if ($fh === false || !function_exists('curl_init')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'storage unavailable';
    exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_FILE => $fh,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_FOLLOWLOCATION => true,
]);
$ok = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);
fclose($fh);

if (!$ok || $code !== 200 || filesize($tmp) === 0) {
    @unlink($tmp);
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'upstream failed: ' . $code;
    exit;
}

@rename($tmp, $file);
@chmod($file, 0600);
if ($type !== '') {
    @file_put_contents($metaFile, explode(';', $type)[0]);
}

serveFile($file, $metaFile, $isVideo);
