<?php
/**
 * Приём заявок на российском хостинге (reg.ru).
 *
 * Требование 152-ФЗ (ст. 18 ч. 5): запись, систематизация, накопление и
 * хранение персональных данных граждан РФ должны выполняться в базах данных,
 * расположенных на территории России. Поэтому первичная запись заявки
 * сохраняется здесь, на сервере в РФ, и только после этого копия уходит в
 * Telegram-уведомление (трансграничная передача — вторична по отношению к
 * первичной записи).
 *
 * Файл с заявками лежит ВЫШЕ каталога сайта, поэтому по HTTP недоступен.
 */

declare(strict_types=1);

// Куда пересылать уведомление менеджеру (Telegram-бот на Cloudflare Workers).
// Пересылка идёт server-to-server: браузер посетителя с зарубежным сервисом
// не соединяется.
const NOTIFY_URL = 'https://diauto-bot.d-karatsapov.workers.dev/lead';

// Каталог хранения — вне docroot сайта.
const STORE_DIR = __DIR__ . '/../../private-leads';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(int $code, string $msg): never
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'method not allowed');
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 8 * 1024 * 1024) {
    fail(413, 'payload too large');
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    fail(400, 'bad json');
}

$name = trim((string) ($data['name'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));

// Телефон — единственное обязательное поле: без него заявка бесполезна.
if (preg_match_all('/\d/', $phone) < 10) {
    fail(422, 'phone required');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

// Простой антифлуд: не больше 10 заявок с одного адреса в час.
if ($ip !== '') {
    $throttle = sys_get_temp_dir() . '/lead-' . md5($ip);
    $hits = @json_decode((string) @file_get_contents($throttle), true);
    $hits = is_array($hits) ? array_values(array_filter($hits, fn($t) => $t > time() - 3600)) : [];
    if (count($hits) >= 10) {
        fail(429, 'too many requests');
    }
    $hits[] = time();
    @file_put_contents($throttle, json_encode($hits), LOCK_EX);
}

if (!is_dir(STORE_DIR) && !@mkdir(STORE_DIR, 0700, true) && !is_dir(STORE_DIR)) {
    fail(500, 'storage unavailable');
}

// Фото в первичную запись не кладём — файл заявок должен оставаться лёгким,
// изображение уходит только в уведомление.
$record = $data;
unset($record['photo']);
$record['ts'] = date('c');
$record['ip'] = $ip;
$record['ua'] = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);

$file = STORE_DIR . '/leads-' . date('Y-m') . '.jsonl';
$line = json_encode($record, JSON_UNESCAPED_UNICODE) . "\n";
if (@file_put_contents($file, $line, FILE_APPEND | LOCK_EX) === false) {
    fail(500, 'write failed');
}
@chmod($file, 0600);

// Уведомление менеджеру. Заявка уже сохранена в РФ, поэтому сбой пересылки
// не должен приводить к ошибке для посетителя.
$notified = false;
$upstream = ['code' => 0, 'body' => '', 'error' => ''];
if (function_exists('curl_init')) {
    $ch = curl_init(NOTIFY_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $raw,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch);
    $upstream['code'] = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $upstream['error'] = curl_error($ch);
    $upstream['body'] = is_string($res) ? mb_substr($res, 0, 300) : '';
    curl_close($ch);
    $notified = $res !== false && $upstream['code'] < 400;
} else {
    $upstream['error'] = 'curl unavailable';
}

// Результат доставки пишем рядом с заявкой: если уведомление не дошло,
// по этой строке видно, на каком шаге всё встало.
@file_put_contents(
    STORE_DIR . '/notify-' . date('Y-m') . '.log',
    date('c') . ' ' . json_encode(['notified' => $notified] + $upstream, JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX,
);

echo json_encode(
    ['ok' => true, 'notified' => $notified, 'upstream' => $upstream],
    JSON_UNESCAPED_UNICODE,
);
