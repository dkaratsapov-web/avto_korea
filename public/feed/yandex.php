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

const WORKER = 'https://diauto-bot.d-karatsapov.workers.dev';
const CACHE_FILE = __DIR__ . '/../../private-cache/yandex-feed.xml';
const CACHE_TTL = 3600;

const SITE_URL = 'https://авто-из-кореи-под-ключ.рф';
const SHOP_NAME = 'ДиАвто69';
const COMPANY = 'ИП Петренко Дмитрий Анатольевич';

const COUNTRIES = [
    'kr' => 'Корея',
    'cn' => 'Китай',
    'jp' => 'Япония',
    'eu' => 'Европа',
];

header('Content-Type: application/xml; charset=utf-8');

// Свежий кэш отдаём сразу.
if (is_file(CACHE_FILE) && (time() - (int) filemtime(CACHE_FILE)) < CACHE_TTL) {
    readfile(CACHE_FILE);
    exit;
}

/** Каталог из воркера. */
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

$catalog = loadCatalog();

// Воркер недоступен — лучше отдать вчерашний фид, чем пустой.
if (!$catalog) {
    if (is_file(CACHE_FILE)) {
        readfile(CACHE_FILE);
        exit;
    }
    http_response_code(503);
    echo '<?xml version="1.0" encoding="UTF-8"?><error>catalog unavailable</error>';
    exit;
}

/** Марка — первое слово названия, остальное считаем моделью. */
function splitModel(string $model): array
{
    $parts = preg_split('/\s+/u', trim($model), 2);
    return [$parts[0] ?? $model, $parts[1] ?? ''];
}

function x(string $v): string
{
    return htmlspecialchars($v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

/**
 * Абсолютный адрес картинки на нашем домене.
 *
 * Воркер отдаёт фото ссылками на себя (*.workers.dev), а этот домен в России
 * блокируется — робот Яндекса такие картинки не скачает, и в объявлении вместо
 * фото остаётся заглушка. Сайт для браузера подменяет их в proxy.php; фид ходит
 * к воркеру напрямую, поэтому подменяет сам: /api/tgphoto отдаёт media.php с
 * российского хостинга.
 */
function abs_url(string $u): string
{
    if (str_starts_with($u, WORKER . '/api/')) {
        $u = substr($u, strlen(WORKER));
    }
    return preg_match('#^https?://#i', $u) ? $u : SITE_URL . $u;
}

$out = [];
$out[] = '<?xml version="1.0" encoding="UTF-8"?>';
$out[] = '<yml_catalog date="' . date('Y-m-d H:i') . '">';
$out[] = '<shop>';
$out[] = '<name>' . x(SHOP_NAME) . '</name>';
$out[] = '<company>' . x(COMPANY) . '</company>';
$out[] = '<url>' . x(SITE_URL) . '</url>';
$out[] = '<currencies><currency id="RUR" rate="1"/></currencies>';
$out[] = '<categories><category id="1">Автомобили</category></categories>';
$out[] = '<offers>';

foreach ($catalog as $c) {
    $price = (int) ($c['priceTverRub'] ?? $c['priceRub'] ?? 0);
    if ($price <= 0 || empty($c['id']) || empty($c['model'])) {
        continue;
    }

    [$vendor, $model] = splitModel((string) $c['model']);
    $year = (int) ($c['year'] ?? 0);
    // У каждого авто свой адрес: каталог открывает карточку по параметру car.
    $url = SITE_URL . '/catalog?car=' . rawurlencode((string) $c['id']);

    $out[] = '<offer id="' . x((string) $c['id']) . '" type="vendor.model" available="true">';
    $out[] = '<url>' . x($url) . '</url>';
    $out[] = '<price>' . $price . '</price>';
    $out[] = '<currencyId>RUR</currencyId>';
    $out[] = '<categoryId>1</categoryId>';
    $out[] = '<vendor>' . x($vendor) . '</vendor>';
    // Название объявления Яндекс склеивает из typePrefix + vendor + model.
    // Префикс не выводим: «Автомобиль Kia K3 2026» — лишнее слово в заголовке.
    $out[] = '<model>' . x(trim($model . ' ' . ($year ?: ''))) . '</model>';

    foreach (array_slice((array) ($c['images'] ?? []), 0, 10) as $img) {
        if (is_string($img) && $img !== '') {
            $out[] = '<picture>' . x(abs_url($img)) . '</picture>';
        }
    }

    $desc = (string) ($c['description'] ?? '');
    if ($desc !== '') {
        $out[] = '<description>' . x(mb_substr($desc, 0, 3000)) . '</description>';
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
            $out[] = '<param name="' . x((string) $name) . '">' . x((string) $value) . '</param>';
        }
    }

    $out[] = '</offer>';
}

$out[] = '</offers>';
$out[] = '</shop>';
$out[] = '</yml_catalog>';

$xml = implode("\n", $out);

$dir = dirname(CACHE_FILE);
if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
}
@file_put_contents(CACHE_FILE, $xml, LOCK_EX);

echo $xml;
