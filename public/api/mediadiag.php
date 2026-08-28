<?php
/**
 * Показания приборов по кэшу медиа.
 *
 * Фотографии и видео сайт держит у себя: файл один раз забирается из Telegram
 * через воркер и дальше отдаётся статикой. Пока файлы на месте, страница
 * открывается мгновенно. Если кэш опустел — а на общем хостинге это бывает:
 * кончилось место, чистка у хостера, — каждая картинка идёт качаться заново,
 * и каталог открывается десятки секунд. Снаружи это выглядит просто как
 * «долго грузится», и отличить одно от другого без сервера невозможно.
 *
 * Эта страница отвечает ровно на три вопроса: сколько файлов в кэше, есть ли
 * куда писать и как быстро отвечает воркер. Открывается в браузере:
 * https://<домен>/api/mediadiag
 *
 * Ничего не меняет и ничего не скачивает: смотреть можно в любой момент,
 * в том числе когда сайт лежит.
 */

declare(strict_types=1);

const WORKER = 'https://diauto-bot.d-karatsapov.workers.dev';
const PUBLIC_DIR = __DIR__ . '/../media-cache';
const PRIVATE_DIR = __DIR__ . '/../../private-media';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/** Сколько файлов в каталоге, какого объёма и когда трогали последний. */
function cacheStats(string $dir): array
{
    if (!is_dir($dir)) {
        return ['есть' => false];
    }
    $photos = 0;
    $videos = 0;
    $bytes = 0;
    $newest = 0;
    $oldest = PHP_INT_MAX;
    foreach (scandir($dir) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $path = $dir . '/' . $name;
        if (!is_file($path)) {
            continue;
        }
        // Незавершённые куски и замки в счёт не идут — это не кэш.
        if (str_contains($name, '.part.') || str_ends_with($name, '.lock')) {
            continue;
        }
        $bytes += (int) filesize($path);
        $t = (int) filemtime($path);
        $newest = max($newest, $t);
        $oldest = min($oldest, $t);
        if (str_starts_with($name, 'v_')) {
            $videos++;
        } elseif (str_starts_with($name, 'p_')) {
            $photos++;
        }
    }
    return [
        'есть' => true,
        'можно_писать' => is_writable($dir),
        'фотографий' => $photos,
        'видео' => $videos,
        'занято_мб' => round($bytes / 1048576, 1),
        'самый_свежий' => $newest ? date('Y-m-d H:i', $newest) : null,
        'самый_старый' => $oldest !== PHP_INT_MAX ? date('Y-m-d H:i', $oldest) : null,
    ];
}

$cache = cacheStats(PUBLIC_DIR);
$legacy = cacheStats(PRIVATE_DIR);

/*
 * Сколько места осталось. Это первый подозреваемый: видео отзыва весит
 * десятки мегабайт, и при нехватке места закачка обрывается молча — файл
 * просто не появляется, а страница показывает чёрный прямоугольник.
 */
$free = @disk_free_space(__DIR__);
$total = @disk_total_space(__DIR__);

/*
 * Сколько идёт ответ от воркера. Сам файл не качаем: у видео это десятки
 * мегабайт, и диагностика превратилась бы в нагрузку. Спрашиваем каталог —
 * он маленький и проходит тем же маршрутом.
 */
$upstream = ['проверено' => false];
if (function_exists('curl_init')) {
    $t0 = microtime(true);
    $ch = curl_init(WORKER . '/api/catalog');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $ms = (int) round((microtime(true) - $t0) * 1000);

    $catalog = is_string($res) ? json_decode($res, true) : null;
    $cars = is_array($catalog['catalog'] ?? null) ? $catalog['catalog'] : [];

    // Сколько фотографий каталога уже лежит у нас, а сколько придётся качать
    // при первом же открытии. Это и есть ответ на вопрос «почему долго».
    $want = 0;
    $have = 0;
    foreach ($cars as $c) {
        foreach ((array) ($c['images'] ?? []) as $img) {
            if (!is_string($img) || !preg_match('/[?&]id=([A-Za-z0-9_\-]+)/', $img, $m)) {
                continue;
            }
            $want++;
            $file = PUBLIC_DIR . '/p_' . hash('sha256', $m[1]) . '.jpg';
            if (is_file($file) && filesize($file) > 0) {
                $have++;
            }
        }
    }

    $upstream = [
        'проверено' => true,
        'код' => $code,
        'ответ_мс' => $ms,
        'машин_в_каталоге' => count($cars),
        'фотографий_всего' => $want,
        'из_них_уже_у_нас' => $have,
        'придётся_качать' => $want - $have,
    ];
}

echo json_encode(
    [
        'время' => date('Y-m-d H:i:s'),
        'кэш_медиа' => $cache,
        'старое_хранилище' => $legacy,
        'диск' => [
            'свободно_гб' => $free ? round($free / 1073741824, 2) : null,
            'всего_гб' => $total ? round($total / 1073741824, 2) : null,
            'занято_процентов' => ($free && $total) ? round(100 - $free / $total * 100) : null,
        ],
        'воркер' => $upstream,
    ],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT,
);
