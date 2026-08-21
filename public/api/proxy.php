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

/*
 * Обновляет кэш только один процесс.
 *
 * Кэш каталога живёт минуту. Без замка в момент его протухания ВСЕ посетители,
 * пришедшие одновременно, шли к воркеру разом — и каждый занимал процесс PHP
 * до двенадцати секунд. На общем хостинге процессов у аккаунта единицы, так что
 * очередь упиралась в лимит, и сервер начинал рвать соединения ещё до ответа —
 * включая обычные страницы сайта.
 *
 * Теперь обновляет один, а остальные сразу получают прошлую версию. Данные
 * минутной давности в каталоге никому не мешают, а недоступный сайт — мешает.
 */
$lock = @fopen($cacheFile . '.lock', 'c');

/*
 * Замок не создался — значит блокировки нет вовсе (нет прав на каталог,
 * кончилось место, файл занят чем-то ещё). Тогда обновляем сами.
 *
 * Первая версия в этом случае считала себя «не главным» и уходила отдавать
 * прошлую версию — а раз главным не становился никто, кэш замерзал НАВСЕГДА.
 * Правки в админке не доезжали ни до сайта, ни до бота, и понять почему было
 * невозможно: ошибок нет, данные отдаются, просто старые. Редкий
 * одновременный поход к воркеру — куда меньшее зло.
 */
$leader = $lock === false || flock($lock, LOCK_EX | LOCK_NB);

/*
 * Предохранитель на тот же случай с другой стороны: если прошлая версия
 * старше своего срока в десять раз, обновляем даже стоя в очереди.
 * Застрявший замок не должен замораживать данные насовсем.
 */
$age = is_file($cacheFile) ? time() - (int) filemtime($cacheFile) : PHP_INT_MAX;
$tooOld = $age > TTL[$p] * 10;

if (!$leader && !$tooOld && is_file($cacheFile)) {
    if ($lock !== false) {
        fclose($lock);
    }
    header('Cache-Control: public, max-age=15');
    header('X-Stale-Cache: 1');
    readfile($cacheFile);
    exit;
}

$body = null;
if (function_exists('curl_init')) {
    $ch = curl_init(WORKER . '/api/' . $p);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        // Потолок удержания процесса. Лучше отдать прошлую версию, чем
        // держать место в очереди двенадцать секунд.
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($res !== false && $code === 200 && $res !== '') {
        $body = $res;
    }
}

if ($lock !== false) {
    flock($lock, LOCK_UN);
    fclose($lock);
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
