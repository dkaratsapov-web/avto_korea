<?php
/**
 * Товарный фид (YML) для Яндекса — динамические объявления и смарт-баннеры.
 *
 * Собирается из живого каталога: сервер берёт данные у воркера, поэтому фид
 * всегда соответствует сайту и обновлять его руками не нужно. Ответ
 * кэшируется на час — Яндекс забирает фид не чаще раза в сутки.
 *
 * Адрес для Яндекс.Директа: https://<домен>/feed/yandex.xml
 */

declare(strict_types=1);

/*
 * Источник данных, реквизиты и общие для всех фидов помощники — в отдельном
 * файле: тем же каталогом кормится фид 2ГИС (2gis.php), и адрес воркера с
 * названием ИП не должны лежать в двух местах.
 */
require_once __DIR__ . '/catalog-source.php';

const CACHE_TTL = 3600;

/**
 * Режим фида.
 *
 * direct   — для Яндекс.Директа: все фото и полное описание.
 * business — для Яндекс.Бизнеса: он берёт только первую картинку и режет
 *            описание после 250 символов. Режем сами по границе предложения,
 *            иначе текст обрывается посреди слова.
 */
$mode = (($_GET['mode'] ?? '') === 'business') ? 'business' : 'direct';
$isBusiness = $mode === 'business';

// У каждого режима свой кэш: иначе Бизнес получил бы файл, собранный для Директа.
define('CACHE_FILE', __DIR__ . "/../../private-cache/yandex-feed-{$mode}.xml");

header('Content-Type: application/xml; charset=utf-8');

// Кэш протухает и сам по себе, и при выкладке новой версии сборщика: он лежит
// вне сайта, деплой его не трогает, а иначе правка фида доезжала бы до Яндекса
// только через час и после ручного удаления файла.
if (cacheIsFresh(CACHE_FILE, CACHE_TTL, [__FILE__, __DIR__ . '/catalog-source.php'])) {
    readfile(CACHE_FILE);
    exit;
}

$catalog = loadCatalog();

// Воркер недоступен — лучше отдать вчерашний фид, чем пустой.
if (!$catalog) {
    serveStaleOrFail(CACHE_FILE, 'application/xml');
}

$out = [];
$out[] = '<?xml version="1.0" encoding="UTF-8"?>';
$out[] = '<yml_catalog date="' . date('Y-m-d H:i') . '">';
$out[] = '<shop>';
$out[] = '<name>' . x(SHOP_NAME) . '</name>';
$out[] = '<company>' . x(COMPANY) . '</company>';
$out[] = '<url>' . x(SITE_URL) . '</url>';
$out[] = '<currencies><currency id="RUR" rate="1"/></currencies>';

// Офферы копим отдельно: категории известны только после разбора каталога,
// а в YML блок categories обязан идти раньше offers.
$offers = [];
$brands = [];

foreach ($catalog as $c) {
    $price = feedPrice($c);
    if ($price <= 0 || empty($c['id']) || empty($c['model'])) {
        continue;
    }

    [$vendor, $model] = splitModel((string) $c['model']);
    $year = (int) ($c['year'] ?? 0);
    // У каждого авто свой адрес: каталог открывает карточку по параметру car.
    $url = SITE_URL . '/catalog?car=' . rawurlencode((string) $c['id']);

    // Упрощённый тип оффера: заголовок берётся из <name> как есть.
    // У типа vendor.model Яндекс склеивает заголовок сам, из
    // typePrefix + vendor + model, и требует typePrefix обязательно — без него
    // офферы отклоняются, а с ним в заголовке появляется лишнее «Автомобиль».
    $name = trim($vendor . ' ' . $model . ' ' . ($year ?: ''));

    $offers[] = '<offer id="' . x((string) $c['id']) . '" available="true">';
    // Марка становится разделом каталога: без этого все авто лежат одной
    // кучей и в карточке организации их невозможно просматривать.
    // Группируем по регистронезависимому ключу: в постах канала марку пишут
    // вразнобой («audi» и «AUDI»), а два раздела с одним id — невалидный YML.
    $brandKey = mb_strtolower($vendor, 'UTF-8');
    $brands[$brandKey][$vendor] = ($brands[$brandKey][$vendor] ?? 0) + 1;

    $offers[] = '<name>' . x($name) . '</name>';
    $offers[] = '<url>' . x($url) . '</url>';
    $offers[] = '<price>' . $price . '</price>';
    $offers[] = '<currencyId>RUR</currencyId>';
    $offers[] = '<categoryId>' . categoryId($vendor) . '</categoryId>';
    $offers[] = '<vendor>' . x($vendor) . '</vendor>';

    // Бизнес всё равно берёт только первую картинку и предупреждает об этом.
    $maxPictures = $isBusiness ? 1 : 10;
    foreach (array_slice((array) ($c['images'] ?? []), 0, $maxPictures) as $img) {
        if (is_string($img) && $img !== '') {
            $offers[] = '<picture>' . x(abs_url($img)) . '</picture>';
        }
    }

    $desc = (string) ($c['description'] ?? '');
    if ($desc !== '') {
        $desc = $isBusiness ? shortDescription($desc) : mb_substr($desc, 0, 3000);
        $offers[] = '<description>' . x($desc) . '</description>';
    }

    $country = COUNTRIES[(string) ($c['country'] ?? '')] ?? '';
    $params = [
        'Год выпуска' => $year ?: '',
        'Пробег' => (string) ($c['mileage'] ?? ''),
        'Двигатель' => (string) ($c['engine'] ?? ''),
        'Мощность' => ($c['powerHp'] ?? 0) ? $c['powerHp'] . ' л.с.' : '',
        'Коробка передач' => (string) ($c['gearbox'] ?? ''),
        'Привод' => (string) ($c['drive'] ?? ''),
        'Тип кузова' => (string) ($c['bodyType'] ?? ''),
        'Тип топлива' => (string) ($c['fuelType'] ?? ''),
        'Комплектация' => (string) ($c['trim'] ?? ''),
        'Страна вывоза' => $country,
        'Состояние' => !empty($c['isNew']) ? 'Новый' : 'С пробегом',
    ];
    foreach ($params as $name => $value) {
        if ($value !== '' && $value !== 0) {
            $offers[] = '<param name="' . x((string) $name) . '">' . x((string) $value) . '</param>';
        }
    }

    $offers[] = '</offer>';
}

// Разделы: корневая «Автомобили» и по одной категории на марку. Пустых не
// будет — марки взяты из тех авто, что реально попали в фид.
$out = array_merge($out, categoriesXml($brands));

$out[] = '<offers>';
$out = array_merge($out, $offers);
$out[] = '</offers>';
$out[] = '</shop>';
$out[] = '</yml_catalog>';

$xml = implode("\n", $out);

cacheStore(CACHE_FILE, $xml);

echo $xml;
