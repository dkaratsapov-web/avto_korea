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

const SITE_URL = 'https://автоимпорт-69.рф';
const SHOP_NAME = 'ДиАвто69';
const COMPANY = 'ИП Петренко Дмитрий Анатольевич';

const COUNTRIES = [
    'kr' => 'Корея',
    'cn' => 'Китай',
    'jp' => 'Япония',
    'eu' => 'Европа',
];

header('Content-Type: application/xml; charset=utf-8');

/**
 * Кэш годен, пока не истёк час и пока он новее самого скрипта.
 *
 * Кэш лежит вне сайта, деплой его не трогает — без второго условия правка
 * фида доезжала бы до Яндекса только через час, да ещё и после ручного
 * удаления файла. Выкладка обновляет время у yandex.php, и кэш протухает сам.
 */
function cacheIsFresh(): bool
{
    if (!is_file(CACHE_FILE)) {
        return false;
    }
    $age = (int) filemtime(CACHE_FILE);
    return time() - $age < CACHE_TTL && $age >= (int) filemtime(__FILE__);
}

if (cacheIsFresh()) {
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

/**
 * Короткое описание: не длиннее лимита и без обрыва посреди слова.
 * Режем по концу предложения, если он есть в пределах лимита, иначе по пробелу.
 */
function shortDescription(string $text, int $limit = 250): string
{
    $text = trim(preg_replace('/\s+/u', ' ', $text));
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

const ROOT_CATEGORY_ID = 1;

/**
 * Идентификатор категории по названию марки.
 *
 * Считаем от самого названия, а не по порядку в списке: при нумерации подряд
 * появление новой марки сдвинуло бы номера у всех следующих, и Яндекс на
 * каждой выгрузке считал бы категории новыми.
 *
 * Диапазон начинается с 2 — единица занята корневой «Автомобили».
 */
function categoryId(string $brand): int
{
    return 2 + (crc32(mb_strtolower(trim($brand), 'UTF-8')) % 1000000);
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
    $price = (int) ($c['priceTverRub'] ?? $c['priceRub'] ?? 0);
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
ksort($brands, SORT_NATURAL | SORT_FLAG_CASE);
$out[] = '<categories>';
$out[] = '<category id="' . ROOT_CATEGORY_ID . '">Автомобили</category>';
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

$out[] = '<offers>';
$out = array_merge($out, $offers);
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
