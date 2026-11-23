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

/**
 * Отдать файл вторым адресом — статикой, силами Apache.
 *
 * В адресе намеренно остаётся исходный file_id. Apache на существующий файл
 * запрос со строкой параметров отдаёт как есть, а вот если файла НЕТ, по этому
 * же адресу отрабатывает media.php и скачивает его заново (правило в
 * .htaccess). Без file_id восстановить файл было бы не из чего: имя — это
 * необратимый хэш.
 *
 * Зачем это нужно. Файл на конце адреса может исчезнуть: видео отзыва весит
 * десятки мегабайт, и на общем хостинге такой файл рано или поздно уезжает —
 * кончилось место, чистка у хостера. Раньше браузер после этого получал по
 * тому же адресу страницу сайта с кодом 200, считал видео успешно
 * загруженным и показывал чёрный прямоугольник. Обновление не помогало
 * никогда: до PHP запрос уже не доходил, скачать файл заново было некому.
 *
 * СРОК КЭША — год, и это принципиально. Ради этого вся затея и была: пока
 * адрес лежит в кэше браузера, ни одна фотография каталога не открывает
 * процесс PHP. Я как-то снизил срок до суток, чтобы «расклеить» испорченные
 * ссылки у тех, кто уже открывал сайт, — и мини-апп сразу стал заметно
 * медленнее: три десятка фотографий снова пошли через PHP.
 *
 * Правильное лекарство от испорченных ссылок другое и стоит ноль: в
 * api/proxy.php у адресов медиа есть номер поколения (MEDIA_REV). Поднять
 * его — значит выдать браузеру НОВЫЙ адрес, которого в его кэше нет. Старая
 * запись при этом просто перестаёт использоваться.
 */
function serveStatic(string $name, string $id): never
{
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Location: /media-cache/' . $name . '?id=' . rawurlencode($id), true, 302);
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
    serveStatic($publicName, $id);
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
        serveStatic($publicName, $id);
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
 * Потолок на удержание процесса при закачке.
 *
 * У фотографий он короткий: их на странице десятки, и это они укладывали
 * сайт, занимая по процессу каждая.
 *
 * У видео — длинный, и это осознанно. Отзыв из Telegram весит десятки
 * мегабайт, и за двадцать секунд он с чужого сервера не всегда доезжает:
 * закачка обрывается, страница получает 502, а на месте плеера остаётся
 * чёрный прямоугольник. Прежней опасности тут нет — замок ниже пропускает
 * к закачке ровно один процесс, а видео на странице одно-два, не тридцать.
 */
$fetchTimeout = $isVideo ? 60 : 10;

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
            serveStatic($publicName, $id);
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
    serveStatic($publicName, $id);
}

serveFile($file, $metaFile, $isVideo);
