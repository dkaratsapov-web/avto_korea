<?php
/**
 * Прокси публичных данных бота через российский хостинг.
 *
 * Домен воркера (*.workers.dev) в России блокируется провайдерами, поэтому
 * браузер посетителя не должен обращаться к нему напрямую. Запрос идёт на
 * сайт, сервер сам забирает данные у воркера и отдаёт их со своего адреса.
 * Ответы кэшируются на диске: это и ускоряет выдачу, и позволяет показать
 * последние известные данные, если воркер временно недоступен.
 *
 * Маршруты (см. .htaccess): /api/catalog, /api/reviews, /api/news,
 * /api/faq, /api/rates.
 */

declare(strict_types=1);

const WORKER = 'https://diauto-bot.d-karatsapov.workers.dev';
const CACHE_DIR = __DIR__ . '/../../private-cache';

// Сколько секунд свежий кэш отдаётся без обращения к воркеру.
const TTL = [
    'catalog' => 60,
    'reviews' => 120,
    'news' => 120,
    'faq' => 600,
    'rates' => 3600,
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$p = (string) ($_GET['p'] ?? '');

// POST-запросы (мини-апп, статистика, подписки) просто пробрасываем дальше:
// кэшировать их нельзя, но идти напрямую в заблокированный домен браузер
// тоже не должен.
const POST_ALLOWED = ['admin', 'ping', 'view', 'fav', 'subscribe'];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!in_array($p, POST_ALLOWED, true) || !function_exists('curl_init')) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'unknown endpoint']);
        exit;
    }
    $raw = (string) file_get_contents('php://input');
    $ch = curl_init(WORKER . '/api/' . $p);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $raw,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($res === false) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'upstream unavailable']);
        exit;
    }
    http_response_code($code ?: 200);
    echo str_replace(WORKER . '/api/', '/api/', (string) $res);
    exit;
}

if (!isset(TTL[$p])) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'unknown endpoint']);
    exit;
}

if (!is_dir(CACHE_DIR)) {
    @mkdir(CACHE_DIR, 0700, true);
}
$cacheFile = CACHE_DIR . '/' . $p . '.json';
$fresh = is_file($cacheFile) && (time() - (int) filemtime($cacheFile)) < TTL[$p];

if ($fresh) {
    header('Cache-Control: public, max-age=30');
    readfile($cacheFile);
    exit;
}

$body = null;
if (function_exists('curl_init')) {
    $ch = curl_init(WORKER . '/api/' . $p);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($res !== false && $code === 200 && $res !== '') {
        $body = $res;
    }
}

if ($body !== null) {
    // Ссылки на медиа внутри ответа тоже переводим на свой домен, иначе
    // картинки снова пойдут напрямую в заблокированный Cloudflare.
    $body = str_replace(WORKER . '/api/', '/api/', $body);
    @file_put_contents($cacheFile, $body, LOCK_EX);
    header('Cache-Control: public, max-age=30');
    echo $body;
    exit;
}

// Воркер недоступен — отдаём последние известные данные.
if (is_file($cacheFile)) {
    header('Cache-Control: public, max-age=15');
    header('X-Stale-Cache: 1');
    readfile($cacheFile);
    exit;
}

http_response_code(502);
echo json_encode(['ok' => false, 'error' => 'upstream unavailable'], JSON_UNESCAPED_UNICODE);
