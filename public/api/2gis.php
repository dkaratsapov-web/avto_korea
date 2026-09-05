<?php
/**
 * Оценка и отзывы компании в 2ГИС.
 *
 * У Яндекса есть готовый виджет отзывов, который вставляется рамкой. У 2ГИС
 * такого виджета нет: карточку компании в рамку не пустить. Поэтому карточку
 * рисуем сами, а данные для неё берём здесь — с публичного адреса, из
 * которого их читает и сам сайт 2gis.ru.
 *
 * Ходит на 2ГИС сервер, а не браузер: ключ и адрес остаются на нашей стороне,
 * а ответ кэшируется — оценка меняется раз в неделю, а посетителей на странице
 * бывает много.
 *
 * Отдаём ровно то, что пришло от 2ГИС. Если не пришло ничего — так и говорим:
 * ok=false. Витрина в этом случае покажет карточку без цифр, но со ссылками.
 * Нарисовать «4,9» из головы нельзя: это ровно тот обман, из-за которого
 * отзывам на сайтах и не верят.
 */

declare(strict_types=1);

const GIS_BRANCH = '70000001110299440';
const GIS_CACHE = __DIR__ . '/../../private-cache/2gis.json';

/** Сколько живёт кэш. Оценка справочника меняется не по часам. */
const GIS_TTL = 6 * 3600;

/** Ключ публичного API отзывов — тот же, с которым работает сайт 2gis.ru. */
const GIS_KEY = '6e7e1929-4ea9-4a5d-8c05-d601860389bd';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$dir = dirname(GIS_CACHE);
if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
}

$fresh = is_file(GIS_CACHE) && (time() - (int) filemtime(GIS_CACHE)) < GIS_TTL;
if ($fresh) {
    header('Cache-Control: public, max-age=1800');
    readfile(GIS_CACHE);
    exit;
}

/**
 * Запрос к 2ГИС.
 *
 * Возвращает null при любой неудаче: сеть, отказ, невнятный ответ. Разбирать
 * причины здесь незачем — витрине важно только «есть данные или нет».
 */
function gisFetch(): ?array
{
    if (!function_exists('curl_init')) {
        return null;
    }

    $url = 'https://public-api.reviews.2gis.com/2.0/branches/' . GIS_BRANCH . '/reviews'
        . '?limit=12&is_advertiser=false&fields=meta.branch_rating,meta.branch_reviews_count,meta.total_count'
        . '&without_my_first_review=false&rated=true&sort_by=date_edited&locale=ru_RU&key=' . GIS_KEY;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if (!is_string($res) || $code !== 200) {
        return null;
    }
    $data = json_decode($res, true);
    return is_array($data) ? $data : null;
}

/** Приводим ответ 2ГИС к тем полям, которые рисует карточка. */
function gisShape(array $data): ?array
{
    $meta = $data['meta'] ?? [];
    $rating = (float) ($meta['branch_rating'] ?? 0);
    $count = (int) ($meta['branch_reviews_count'] ?? $meta['total_count'] ?? 0);
    if ($rating <= 0) {
        return null;
    }

    $reviews = [];
    foreach ((array) ($data['reviews'] ?? []) as $r) {
        $text = trim((string) ($r['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $reviews[] = [
            'name' => (string) ($r['user']['name'] ?? 'Гость'),
            // Дату отдаём как есть — приводить её к виду решает витрина.
            'date' => (string) ($r['date_created'] ?? ''),
            'rating' => (int) ($r['rating'] ?? 5),
            'text' => mb_substr($text, 0, 600),
        ];
        if (count($reviews) >= 8) {
            break;
        }
    }

    return ['ok' => true, 'rating' => round($rating, 1), 'count' => $count, 'reviews' => $reviews];
}

$data = gisFetch();
$shaped = $data !== null ? gisShape($data) : null;

if ($shaped !== null) {
    @file_put_contents(GIS_CACHE, json_encode($shaped, JSON_UNESCAPED_UNICODE), LOCK_EX);
    header('Cache-Control: public, max-age=1800');
    echo json_encode($shaped, JSON_UNESCAPED_UNICODE);
    exit;
}

/*
 * Не дозвонились. Прошлый ответ, даже просроченный, честнее пустоты: оценка
 * компании за полдня не меняется, а карточка без цифр выглядит как поломка.
 */
if (is_file(GIS_CACHE)) {
    header('Cache-Control: public, max-age=300');
    header('X-Stale-Cache: 1');
    readfile(GIS_CACHE);
    exit;
}

header('Cache-Control: public, max-age=120');
echo json_encode(['ok' => false], JSON_UNESCAPED_UNICODE);
