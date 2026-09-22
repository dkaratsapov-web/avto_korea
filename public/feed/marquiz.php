<?php
/**
 * Таблица товаров для квиза Marquiz — точка входа.
 *
 * Собирается из живого каталога, поэтому перед загрузкой в Marquiz файл не
 * нужно ни готовить, ни править: скачал по ссылке — залил. Проданные машины
 * из каталога уходят сами, значит и в файле их не будет.
 *
 * Адреса:
 *   https://<домен>/feed/marquiz.csv          — машины по одной;
 *   https://<домен>/feed/marquiz-segments.csv — четыре подборки по цене.
 *
 * Подборки нужны потому, что импорт грузит карточки, но не правила: какая
 * машина под какой ответ — задаётся в Marquiz у каждого результата отдельно.
 * На трёхстах машинах это не настраивается, на четырёх подборках — один раз.
 *
 * Marquiz импортирует товары загрузкой файла, а не по ссылке, поэтому файл
 * отдаётся как вложение: браузер сразу сохранит его, а не покажет простынёй
 * текста. Ответ кэшируется на час.
 *
 * Как собирается содержимое — в marquiz-build.php.
 */

declare(strict_types=1);

require_once __DIR__ . '/catalog-source.php';
require_once __DIR__ . '/marquiz-build.php';
require_once __DIR__ . '/marquiz-segments-build.php';

const CACHE_TTL = 3600;

$isSegments = ($_GET['mode'] ?? '') === 'segments';

$cacheFile = __DIR__ . '/../../private-cache/'
    . ($isSegments ? 'marquiz-segments.csv' : 'marquiz-feed.csv');

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="'
    . ($isSegments ? 'diavto69-marquiz-segments.csv' : 'diavto69-marquiz.csv') . '"');
header('X-Content-Type-Options: nosniff');

$sources = [
    __FILE__,
    __DIR__ . '/marquiz-build.php',
    __DIR__ . '/marquiz-segments-build.php',
    __DIR__ . '/2gis-build.php',
    __DIR__ . '/catalog-source.php',
];

if (cacheIsFresh($cacheFile, CACHE_TTL, $sources)) {
    readfile($cacheFile);
    exit;
}

$catalog = loadCatalog();
if (!$catalog) {
    serveStaleOrFail($cacheFile, 'text/csv');
}

$body = $isSegments ? feedMarquizSegmentsCsv($catalog) : feedMarquizCsv($catalog);

cacheStore($cacheFile, $body);
echo $body;
