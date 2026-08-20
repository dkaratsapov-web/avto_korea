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

/*
 * Второй адрес того же файла — внутри каталога сайта.
 *
 * Раньше каждая картинка на каждом показе страницы проходила через PHP:
 * процесс открывался, читал файл с диска и отдавал его браузеру, оставаясь
 * занятым всё время передачи. На карточке автомобиля таких картинок три
 * десятка, а процессов у аккаунта на общем хостинге единицы — и на медленном
 * мобильном интернете страница каталога занимала их все. Сервер в этот момент
 * принимает соединение и рвёт его без ответа: «сайт неожиданно разорвал
 * соединение», причём на всех страницах сразу, не только на каталоге.
 *
 * Отсюда файл отдаёт сам Apache, без единого процесса PHP. Имя постоянное
 * (хэш от file_id), содержимое к нему привязано навсегда, поэтому и редирект,
 * и сам файл кэшируются браузером на год: со второго показа страницы
 * обращений к PHP не остаётся вовсе.
 */
const PUBLIC_DIR = __DIR__ . '/../media-cache';
$publicName = $key . ($isVideo ? '.mp4' : '.jpg');
$publicFile = PUBLIC_DIR . '/' . $publicName;

function serveStatic(string $name): never
{
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Location: /media-cache/' . $name, true, 302);
    exit;
}

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

if (is_file($publicFile) && filesize($publicFile) > 0) {
    serveStatic($publicName);
}

if (is_file($file) && filesize($file) > 0) {
    /*
     * Файл из старого хранилища переносим в открытый каталог: скачивать его
     * заново незачем, а дальше он будет отдаваться уже без PHP.
     *
     * Именно переносим, а не копируем: на общем хостинге диск один на сайт
     * и CRM, и держать два экземпляра каждой фотографии — верный способ
     * упереться в квоту. Перенос в пределах одного диска атомарен и почти
     * ничего не стоит.
     */
    if (!is_dir(PUBLIC_DIR)) {
        @mkdir(PUBLIC_DIR, 0755, true);
    }
    if (@rename($file, $publicFile)) {
        @chmod($publicFile, 0644);
        @unlink($metaFile);
        serveStatic($publicName);
    }
    // Перенести не вышло (нет прав, кончилось место) — отдаём как раньше.
    serveFile($file, $metaFile, $isVideo);
}

// Файла ещё нет — забираем у воркера.
$url = WORKER . ($isVideo ? '/api/tgvideo?id=' : '/api/tgphoto?id=') . rawurlencode($id);

/*
 * Скачивает только один процесс. Без этого замка каталог с новыми машинами
 * укладывал сайт целиком: на странице три десятка фотографий, все не в кэше,
 * и каждая занимала свой процесс PHP на всё время загрузки. На общем хостинге
 * процессов у аккаунта единицы, поэтому очередь мгновенно упиралась в лимит —
 * и сервер начинал рвать соединения ДО ответа, включая обычные страницы.
 * Снаружи это выглядит как «сайт неожиданно разорвал соединение».
 */
/*
 * Потолок на удержание процесса при закачке. Шестьдесят секунд, стоявшие
 * здесь раньше, — это минута занятого процесса на одну картинку.
 */
$fetchTimeout = $isVideo ? 20 : 10;

$lock = @fopen($file . '.lock', 'c');
$leader = $lock !== false && flock($lock, LOCK_EX | LOCK_NB);

if (!$leader) {
    /*
     * Кто-то уже качает этот же файл — ждём его результат.
     *
     * Ждать надо заведомо дольше, чем длится сама закачка, иначе ожидающие
     * отваливаются ровно в тот момент, когда файл почти готов, и посетитель
     * видит дырку вместо фотографии. Поэтому окно считается от таймаута
     * закачки, а не задаётся отдельным числом: поменяется одно — второе
     * подстроится само.
     */
    $deadline = microtime(true) + $fetchTimeout + 4;
    while (microtime(true) < $deadline) {
        usleep(200000);
        clearstatcache(true, $publicFile);
        if (is_file($publicFile) && filesize($publicFile) > 0) {
            if ($lock !== false) {
                fclose($lock);
            }
            serveStatic($publicName);
        }
        clearstatcache(true, $file);
        if (is_file($file) && filesize($file) > 0) {
            if ($lock !== false) {
                fclose($lock);
            }
            serveFile($file, $metaFile, $isVideo);
        }
    }
    if ($lock !== false) {
        fclose($lock);
    }
    // Не дождались — значит, и у качавшего не вышло. Пусть браузер повторит
    // позже: это дешевле, чем держать очередь.
    http_response_code(503);
    header('Retry-After: 2');
    header('Content-Type: text/plain; charset=utf-8');
    echo 'busy';
    exit;
}

// Своё имя для куска: при общем имени два процесса писали бы в один файл
// и на выходе получалась бы битая картинка.
$tmp = $file . '.part.' . getmypid() . bin2hex(random_bytes(4));
$fh = @fopen($tmp, 'wb');
if ($fh === false || !function_exists('curl_init')) {
    flock($lock, LOCK_UN);
    fclose($lock);
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'storage unavailable';
    exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_FILE => $fh,
    CURLOPT_TIMEOUT => $fetchTimeout,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_FOLLOWLOCATION => true,
]);
$ok = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);
fclose($fh);

if (!$ok || $code !== 200 || filesize($tmp) === 0) {
    @unlink($tmp);
    flock($lock, LOCK_UN);
    fclose($lock);
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'upstream failed: ' . $code;
    exit;
}

/*
 * Кладём файл сразу в открытый каталог — дальше его будет отдавать Apache.
 *
 * Переименование атомарно: под своим именем файл появляется уже целиком,
 * и ожидающий процесс не отдаст редирект на недописанный кусок.
 */
if (!is_dir(PUBLIC_DIR)) {
    @mkdir(PUBLIC_DIR, 0755, true);
}
$stored = @rename($tmp, $publicFile);
if ($stored) {
    @chmod($publicFile, 0644);
} else {
    // Открытый каталог недоступен для записи — работаем как раньше, через PHP.
    @rename($tmp, $file);
    @chmod($file, 0600);
    if ($type !== '') {
        @file_put_contents($metaFile, explode(';', $type)[0]);
    }
}

flock($lock, LOCK_UN);
fclose($lock);

if ($stored) {
    serveStatic($publicName);
}

serveFile($file, $metaFile, $isVideo);
