<?php
/**
 * Товарный фид для 2ГИС — точка входа.
 *
 * Собирается из живого каталога: сервер берёт данные у воркера, поэтому фид
 * всегда соответствует сайту и обновлять его руками не нужно. Ответ
 * кэшируется на час — робот площадки забирает фид не чаще раза в сутки.
 *
 * Адреса:
 *   https://<домен>/feed/2gis.xml — ссылка для личного кабинета 2ГИС;
 *   https://<домен>/feed/2gis.csv — тот же каталог таблицей, если товары
 *                                   придётся заводить файлом.
 *
 * Как собирается содержимое — в 2gis-build.php.
 */

declare(strict_types=1);

require_once __DIR__ . '/catalog-source.php';
require_once __DIR__ . '/2gis-build.php';

const CACHE_TTL = 3600;

$isCsv = ($_GET['format'] ?? '') === 'csv';

if ($isCsv) {
    $cacheFile = __DIR__ . '/../../private-cache/2gis-feed.csv';
    header('Content-Type: text/csv; charset=utf-8');
    // Скачивается файлом, а не открывается в браузере простынёй текста.
    header('Content-Disposition: attachment; filename="diavto69-2gis.csv"');
} else {
    $cacheFile = __DIR__ . '/../../private-cache/2gis-feed.xml';
    header('Content-Type: application/xml; charset=utf-8');
}
header('X-Content-Type-Options: nosniff');

$sources = [__FILE__, __DIR__ . '/2gis-build.php', __DIR__ . '/catalog-source.php'];

if (cacheIsFresh($cacheFile, CACHE_TTL, $sources)) {
    readfile($cacheFile);
    exit;
}

$catalog = loadCatalog();
if (!$catalog) {
    serveStaleOrFail($cacheFile, $isCsv ? 'text/csv' : 'application/xml');
}

$body = $isCsv ? feed2gisCsv($catalog) : feed2gisXml($catalog);

cacheStore($cacheFile, $body);
echo $body;
