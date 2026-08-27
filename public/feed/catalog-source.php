<?php
/**
 * Общая часть товарных фидов: откуда берутся данные и как их подписывать.
 *
 * Фидов у сайта несколько (Яндекс.Директ, Яндекс.Бизнес, 2ГИС), содержимое у
 * них разное, а вот источник и реквизиты — одни и те же. Раньше это лежало
 * копией в каждом файле; при смене адреса воркера или названия ИП пришлось бы
 * помнить про все и, разумеется, один бы забылся — сломался бы ровно тот фид,
 * который смотрят реже всего, и заметили бы это через недели.
 *
 * Файл только объявляет константы и функции: ничего не печатает и никуда не
 * ходит при подключении. Поэтому его можно спокойно подключать из тестов.
 */

declare(strict_types=1);

const WORKER = 'https://diauto-bot.d-karatsapov.workers.dev';
const SITE_URL = 'https://автоимпорт-69.рф';
const SHOP_NAME = 'ДиАвто69';
const COMPANY = 'ИП Петренко Дмитрий Анатольевич';

/** Код страны вывоза → как её называть в тексте объявления. */
const COUNTRIES = [
    'kr' => 'Корея',
    'cn' => 'Китай',
    'jp' => 'Япония',
    'eu' => 'Европа',
];

/** Та же страна, но в форме «привезём из ...». */
const COUNTRIES_FROM = [
    'kr' => 'Кореи',
    'cn' => 'Китая',
    'jp' => 'Японии',
    'eu' => 'Европы',
];

/**
 * Каталог из воркера.
 *
 * Ходим к воркеру напрямую, а не через /api/catalog: фид собирает сервер, а
 * не браузер посетителя, и блокировка домена в России ему не мешает.
 * Возвращает пустой массив при любой неудаче — вызывающий сам решит, отдать
 * ли прошлую версию фида.
 */
function loadCatalog(): array
{
    if (!function_exists('curl_init')) {
        return [];
    }
    $ch = curl_init(WORKER . '/api/catalog');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($res === false || $code !== 200) {
        return [];
    }
    $data = json_decode((string) $res, true);
    return is_array($data['catalog'] ?? null) ? $data['catalog'] : [];
}

/**
 * Абсолютный адрес картинки на нашем домене.
 *
 * Воркер отдаёт фото ссылками на себя (*.workers.dev), а этот домен в России
 * блокируется — робот площадки такие картинки не скачает, и в карточке товара
 * вместо фото остаётся пустое место. Сайт для браузера подменяет их в
 * proxy.php; фид ходит к воркеру напрямую, поэтому подменяет сам: /api/tgphoto
 * отдаёт media.php с российского хостинга.
 */
function abs_url(string $u): string
{
    if (str_starts_with($u, WORKER . '/api/')) {
        $u = substr($u, strlen(WORKER));
    }
    return preg_match('#^https?://#i', $u) ? $u : SITE_URL . $u;
}

/** Экранирование для XML. */
function x(string $v): string
{
    return htmlspecialchars($v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

/** Марка — первое слово названия, остальное считаем моделью. */
function splitModel(string $model): array
{
    $parts = preg_split('/\s+/u', trim($model), 2);
    return [$parts[0] ?? $model, $parts[1] ?? ''];
}

const ROOT_CATEGORY_ID = 1;

/**
 * Идентификатор категории по названию марки.
 *
 * Считаем от самого названия, а не по порядку в списке: при нумерации подряд
 * появление новой марки сдвинуло бы номера у всех следующих, и площадка на
 * каждой выгрузке считала бы категории новыми.
 *
 * Диапазон начинается с 2 — единица занята корневой «Автомобили».
 */
function categoryId(string $brand): int
{
    return 2 + (crc32(mb_strtolower(trim($brand), 'UTF-8')) % 1000000);
}

/**
 * Разделы каталога: корневой «Автомобили» и по одному на марку.
 *
 * $brands — то, что накопил сборщик офферов: ключ приведён к нижнему регистру,
 * внутри счётчик написаний. Марку в постах канала пишут вразнобой («audi» и
 * «AUDI»), а два раздела с одним id — невалидный фид.
 */
function categoriesXml(array $brands): array
{
    ksort($brands, SORT_NATURAL | SORT_FLAG_CASE);
    $out = ['<categories>', '<category id="' . ROOT_CATEGORY_ID . '">Автомобили</category>'];
    foreach ($brands as $key => $spellings) {
        // Показываем то написание, которое встречается в каталоге чаще: гадать
        // про заглавные буквы не нужно — «BMW» и «Geely» приходят из данных.
        // При равенстве берём алфавитно, чтобы фид не менялся от выгрузки к выгрузке.
        arsort($spellings);
        $top = max($spellings);
        $best = array_keys(array_filter($spellings, fn($n) => $n === $top));
        sort($best, SORT_NATURAL);
        $out[] = '<category id="' . categoryId($key) . '" parentId="' . ROOT_CATEGORY_ID . '">'
            . x($best[0]) . '</category>';
    }
    $out[] = '</categories>';
    return $out;
}

/**
 * Комплектация, годная для показа, — или пусто.
 *
 * Бот раньше записывал в это поле всю строку после «Комплектация:», включая
 * фразы вроде «оснащена тремя блокировками дифференциалов». Разбор поста давно
 * исправлен, но такие записи остались в каталоге — а в заголовке товара они
 * выглядят как брак.
 *
 * Тот же расчёт есть на сайте (src/data/cars.ts, cleanTrim). Держать их в
 * одном файле нельзя — сайт и фид это разные сборки, — поэтому при правке
 * одного правьте и второй.
 */
function cleanTrim(string $trim): string
{
    $t = trim($trim);
    $len = mb_strlen($t);
    if ($len < 2 || $len > 32) {
        return '';
    }
    if (preg_match('/[.!?]$/u', $t)) {
        return '';
    }
    if (count(preg_split('/\s+/u', $t, -1, PREG_SPLIT_NO_EMPTY)) > 4) {
        return '';
    }
    return preg_match('/(оснащ|имеет|включа|установ|есть\b|доступн|привез)/iu', $t) ? '' : $t;
}

/**
 * Текст без контактов и ссылок.
 *
 * Описания в каталоге сейчас генерируются ботом и чистые, но их можно править
 * руками в админке, а исходно они приходили из постов канала — где нормальны и
 * телефон, и @ник, и хештеги. Площадки такие описания снимают с публикации:
 * увести покупателя мимо площадки — прямое нарушение правил размещения.
 * Дешевле вычистить здесь, чем ловить отклонённые товары по одному.
 */
function stripContacts(string $text): string
{
    $text = preg_replace('#https?://\S+|www\.\S+#iu', '', $text) ?? $text;
    $text = preg_replace('/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/iu', '', $text) ?? $text;
    // @ник — только когда перед ним не буква: иначе выкусит хвост почты.
    $text = preg_replace('/(?<![\p{L}\p{N}])@[a-z0-9_]{3,}/iu', '', $text) ?? $text;
    $text = preg_replace('/(?<![\p{L}\p{N}])#[\p{L}\p{N}_]+/u', '', $text) ?? $text;
    // Телефон в любом привычном виде: +7 (999) 123-45-67, 8 999 1234567.
    $text = preg_replace('/(?<!\d)(?:\+?7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/u', '', $text) ?? $text;
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    // После вырезания остаются висячие знаки препинания и двойные точки.
    $text = preg_replace('/\s+([.,;:!?])/u', '$1', $text) ?? $text;
    $text = preg_replace('/([.,;:])\1+/u', '$1', $text) ?? $text;
    return trim($text, " \t\n\r,;:-—");
}

/**
 * Текст без предложений, в которых были контакты.
 *
 * Вырезать из предложения телефон и оставить остальное — плохая идея: из
 * «Пишите в телеграм @diavto69 или звоните +7 999 …» получается «Пишите в
 * телеграм или звоните», то есть призыв в никуда. Читается как недоделка,
 * а по смыслу всё равно уводит покупателя с площадки.
 *
 * Поэтому предложение, которое при чистке потеряло хоть что-то, выбрасываем
 * целиком, а соседние — не трогаем: одна строка с телефоном в конце не должна
 * стирать нормальное описание.
 */
function keepCleanSentences(string $text): string
{
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    if ($text === '') {
        return '';
    }
    // Разрезаем ПОСЛЕ знака конца предложения, сам знак оставляя при тексте.
    $parts = preg_split('/(?<=[.!?…])\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $kept = [];
    foreach ($parts as $s) {
        $s = trim($s);
        if ($s === '') {
            continue;
        }
        if (stripContacts($s) === rtrim($s, " ,;:-—")) {
            $kept[] = $s;
        }
    }
    return trim(implode(' ', $kept));
}

/**
 * Обрезка по границе предложения: длинный текст площадка режет сама, но
 * посреди слова. Режем по концу предложения, если он есть в пределах лимита,
 * иначе по пробелу.
 */
function shortDescription(string $text, int $limit = 250): string
{
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    if (mb_strlen($text) <= $limit) {
        return $text;
    }
    $cut = mb_substr($text, 0, $limit);
    foreach (['. ', '! ', '? '] as $end) {
        $pos = mb_strrpos($cut, $end);
        // Обрезок меньше половины лимита выглядит куцо — тогда режем по слову.
        if ($pos !== false && $pos > $limit / 2) {
            return mb_substr($cut, 0, $pos + 1);
        }
    }
    $space = mb_strrpos($cut, ' ');
    return rtrim($space !== false ? mb_substr($cut, 0, $space) : $cut, ' ,;:-—') . '…';
}

/**
 * Отдать прошлую версию фида, если она есть, и завершить работу.
 * Пустой фид площадка понимает как «товаров больше нет» и снимает витрину;
 * вчерашние данные несравнимо лучше.
 */
function serveStaleOrFail(string $cacheFile, string $contentType): void
{
    if (is_file($cacheFile)) {
        readfile($cacheFile);
        exit;
    }
    http_response_code(503);
    echo str_contains($contentType, 'xml')
        ? '<?xml version="1.0" encoding="UTF-8"?><error>catalog unavailable</error>'
        : 'catalog unavailable';
    exit;
}

/**
 * Кэш годен, пока не истёк срок и пока он новее файлов, которые его собирают.
 *
 * Кэш лежит вне сайта, деплой его не трогает — без второго условия правка фида
 * доезжала бы до площадки только через час, да ещё и после ручного удаления
 * файла. Выкладка обновляет время у скриптов, и кэш протухает сам.
 *
 * $sources — все файлы, влияющие на содержимое: сам фид и этот источник.
 */
function cacheIsFresh(string $cacheFile, int $ttl, array $sources): bool
{
    if (!is_file($cacheFile)) {
        return false;
    }
    $age = (int) filemtime($cacheFile);
    if (time() - $age >= $ttl) {
        return false;
    }
    foreach ($sources as $src) {
        if (is_file($src) && $age < (int) filemtime($src)) {
            return false;
        }
    }
    return true;
}

/** Записать собранный фид в кэш (каталог создаём при необходимости). */
function cacheStore(string $cacheFile, string $body): void
{
    $dir = dirname($cacheFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    @file_put_contents($cacheFile, $body, LOCK_EX);
}
