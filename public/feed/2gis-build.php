<?php
/**
 * Сборка товарного фида для 2ГИС.
 *
 * Здесь только превращение каталога в файл: ни сети, ни кэша, ни вывода.
 * Точка входа — 2gis.php; отдельный файл нужен, чтобы сборку можно было
 * прогнать тестом на заранее заданном каталоге (scripts/check-feeds.php).
 *
 * ФОРМАТ. 2ГИС принимает фид в YML — том же формате Яндекс.Маркета, что и
 * Яндекс.Директ. Поэтому корень тот же (yml_catalog → shop → offers), но
 * содержимое собрано иначе, и вот почему.
 *
 * Директ показывает объявление: заголовок обрезается, описание почти не видно,
 * важна только цена и картинка. 2ГИС показывает ВИТРИНУ внутри карточки
 * организации — человек листает товары, открывает карточку и читает. Значит:
 *
 *   • заголовок должен быть самодостаточным (марка, модель, год, комплектация);
 *   • описание — про конкретную машину, а не общий текст про импорт под ключ,
 *     иначе все двадцать карточек читаются одинаково и витрина выглядит
 *     как заглушка;
 *   • фотографий несколько — в 2ГИС карточка товара листается;
 *   • в описании не должно быть телефонов, ссылок и @ников: площадки такое
 *     снимают с публикации.
 */

declare(strict_types=1);

require_once __DIR__ . '/catalog-source.php';

/** Сколько фотографий отдаём на товар. */
const GIS_MAX_PICTURES = 10;

/**
 * Потолки на длину.
 *
 * Точные лимиты 2ГИС не проверены по документации, поэтому взяты с запасом:
 * заголовок короче, чем у большинства площадок, описание — вдвое меньше, чем
 * позволяет YML. Урезать всегда безопаснее: слишком длинное поле площадка либо
 * обрежет сама (посреди слова), либо отклонит товар целиком.
 */
const GIS_MAX_NAME = 100;
const GIS_MAX_DESCRIPTION = 1000;

/**
 * Заголовок товара: «Kia K3 2026, Comfort Edition».
 *
 * Комплектацию добавляем только если она похожа на название, а не на кусок
 * рекламного текста (см. cleanTrim), и только если помещается целиком —
 * оборванная на середине комплектация хуже, чем её отсутствие.
 */
function gisName(string $vendor, string $model, int $year, string $trim): string
{
    $base = trim(preg_replace('/\s+/u', ' ', $vendor . ' ' . $model) ?? '');
    if ($year > 0) {
        $base .= ' ' . $year;
    }
    $trim = cleanTrim($trim);
    if ($trim !== '' && mb_strlen($base . ', ' . $trim) <= GIS_MAX_NAME) {
        return $base . ', ' . $trim;
    }
    return mb_substr($base, 0, GIS_MAX_NAME);
}

/**
 * Слово в строчные — но аббревиатуру оставляем как есть.
 *
 * Внутри предложения «Бензин» и «Седан» с большой буквы смотрятся как ошибка,
 * а вот «АКПП» с маленькой — тем более. Отличаем по тому же признаку, по
 * которому это делает человек: слово целиком заглавными не понижаем.
 */
function lc(string $word): string
{
    $w = trim($word);
    return $w === mb_strtoupper($w, 'UTF-8') ? $w : mb_strtolower($w, 'UTF-8');
}

/**
 * Первая буква — заглавная.
 *
 * Встроенный ucfirst работает побайтово и кириллицу не поднимает: предложение
 * молча остаётся со строчной. Заметно это только глазами в готовом фиде,
 * поэтому проверка на это есть в scripts/check-feeds.php.
 */
function ucfirst_u(string $s): string
{
    return $s === '' ? '' : mb_strtoupper(mb_substr($s, 0, 1), 'UTF-8') . mb_substr($s, 1);
}

/**
 * Описание товара: сначала про эту машину, потом про условия покупки.
 *
 * Первая часть собирается из характеристик — она у каждой машины своя.
 * Вторая — текст из каталога (его пишет бот при публикации, править можно в
 * админке); он одинаковый у всех, поэтому идёт вторым и обрезается первым,
 * если не хватает места.
 */
function gisDescription(array $c): string
{
    $sentences = [];

    $mileageKm = (int) ($c['mileageKm'] ?? 0);
    $sentences[] = $mileageKm > 0
        ? 'Пробег ' . number_format($mileageKm, 0, ',', ' ') . ' км'
        : 'Новый автомобиль, пробег 0 км';

    $engine = [];
    if ((int) ($c['engineCc'] ?? 0) > 0) {
        $engine[] = number_format(((int) $c['engineCc']) / 1000, 1, ',', '') . ' л';
    }
    if ((int) ($c['powerHp'] ?? 0) > 0) {
        $engine[] = (int) $c['powerHp'] . ' л.с.';
    }
    foreach (['fuelType', 'gearbox'] as $k) {
        if (($c[$k] ?? '') !== '') {
            $engine[] = lc((string) $c[$k]);
        }
    }
    if ($engine) {
        $sentences[] = 'Двигатель ' . implode(', ', $engine);
    }

    // Ходовая и внешний вид — одним предложением, иначе описание рассыпается
    // на строчку из трёх слов.
    $body = [];
    if (($c['drive'] ?? '') !== '') {
        $body[] = lc((string) $c['drive']) . ' привод';
    }
    if (($c['bodyType'] ?? '') !== '') {
        $body[] = 'кузов ' . lc((string) $c['bodyType']);
    }
    if (($c['color'] ?? '') !== '') {
        $body[] = 'цвет ' . lc((string) $c['color']);
    }
    if ($body) {
        $sentences[] = ucfirst_u(implode(', ', $body));
    }

    $head = implode('. ', $sentences) . '.';

    $tail = keepCleanSentences((string) ($c['description'] ?? ''));
    if ($tail === '') {
        $from = COUNTRIES_FROM[(string) ($c['country'] ?? '')] ?? '';
        $tail = 'Привезём' . ($from ? ' из ' . $from : '')
            . ' под ключ: доставка, растаможка и оформление включены в цену.';
    }

    return shortDescription($head . ' ' . $tail, GIS_MAX_DESCRIPTION);
}

/**
 * Характеристики товара.
 *
 * В 2ГИС они показываются списком под описанием — это то, по чему человек
 * сравнивает две машины, не открывая сайт. Пустые не выводим: строка
 * «Привод: —» выглядит как недоделка.
 */
function gisParams(array $c): array
{
    $year = (int) ($c['year'] ?? 0);
    $params = [
        'Год выпуска' => $year > 0 ? (string) $year : '',
        'Пробег' => (string) ($c['mileage'] ?? ''),
        'Двигатель' => (string) ($c['engine'] ?? ''),
        'Мощность' => (int) ($c['powerHp'] ?? 0) > 0 ? (int) $c['powerHp'] . ' л.с.' : '',
        'Коробка передач' => (string) ($c['gearbox'] ?? ''),
        'Привод' => (string) ($c['drive'] ?? ''),
        'Тип кузова' => (string) ($c['bodyType'] ?? ''),
        'Тип топлива' => (string) ($c['fuelType'] ?? ''),
        'Цвет' => (string) ($c['color'] ?? ''),
        'Комплектация' => cleanTrim((string) ($c['trim'] ?? '')),
        'Руль' => (string) ($c['steering'] ?? ''),
        'Страна вывоза' => COUNTRIES[(string) ($c['country'] ?? '')] ?? '',
        'Состояние' => (int) ($c['mileageKm'] ?? 0) > 0 ? 'С пробегом' : 'Новый',
    ];
    return array_filter($params, fn($v) => trim((string) $v) !== '');
}

/**
 * Строки фида: по одной на машину, годную к показу.
 *
 * Возвращает [строки, марки] — марки нужны для блока категорий, который в YML
 * обязан идти РАНЬШЕ офферов, а известен только после разбора всего каталога.
 */
function gisRows(array $catalog): array
{
    $rows = [];
    $brands = [];

    foreach ($catalog as $c) {
        if (!is_array($c)) {
            continue;
        }
        // Та же цена, что на сайте, — до Москвы. Расхождение между витриной
        // и сайтом дороже, чем разница в сорок тысяч.
        $price = feedPrice($c);
        $images = array_values(array_filter(
            (array) ($c['images'] ?? []),
            fn($i) => is_string($i) && $i !== '',
        ));

        // Товар без цены, без названия или без фотографии витрина не покажет —
        // в лучшем случае он просто не пройдёт загрузку, в худшем окажется
        // в карточке организации пустым прямоугольником.
        if (!feedCarOk($c) || !$images) {
            continue;
        }

        [$vendor, $model] = splitModel((string) $c['model']);
        $brandKey = mb_strtolower($vendor, 'UTF-8');
        $brands[$brandKey][$vendor] = ($brands[$brandKey][$vendor] ?? 0) + 1;

        $rows[] = [
            'id' => (string) $c['id'],
            'name' => gisName($vendor, $model, (int) ($c['year'] ?? 0), (string) ($c['trim'] ?? '')),
            'vendor' => $vendor,
            'price' => $price,
            'categoryId' => categoryId($brandKey),
            'category' => $vendor,
            // У каждой машины свой адрес: каталог открывает карточку по параметру car.
            'url' => SITE_URL . '/catalog?car=' . rawurlencode((string) $c['id']),
            'pictures' => array_map('abs_url', array_slice($images, 0, GIS_MAX_PICTURES)),
            'description' => gisDescription($c),
            'params' => gisParams($c),
        ];
    }

    return [$rows, $brands];
}

/** Готовый YML для 2ГИС. */
function feed2gisXml(array $catalog, ?string $date = null): string
{
    [$rows, $brands] = gisRows($catalog);

    $out = [];
    $out[] = '<?xml version="1.0" encoding="UTF-8"?>';
    $out[] = '<yml_catalog date="' . ($date ?? date('Y-m-d H:i')) . '">';
    $out[] = '<shop>';
    $out[] = '<name>' . x(SHOP_NAME) . '</name>';
    $out[] = '<company>' . x(COMPANY) . '</company>';
    $out[] = '<url>' . x(SITE_URL) . '</url>';
    $out[] = '<currencies><currency id="RUR" rate="1"/></currencies>';
    $out = array_merge($out, categoriesXml($brands));
    $out[] = '<offers>';

    foreach ($rows as $r) {
        // Упрощённый тип оффера: заголовок берётся из <name> как есть.
        // У типа vendor.model площадка склеивает заголовок сама, из
        // typePrefix + vendor + model, и в нём появляется лишнее «Автомобиль».
        $out[] = '<offer id="' . x($r['id']) . '" available="true">';
        $out[] = '<name>' . x($r['name']) . '</name>';
        $out[] = '<url>' . x($r['url']) . '</url>';
        $out[] = '<price>' . $r['price'] . '</price>';
        $out[] = '<currencyId>RUR</currencyId>';
        $out[] = '<categoryId>' . $r['categoryId'] . '</categoryId>';
        $out[] = '<vendor>' . x($r['vendor']) . '</vendor>';
        foreach ($r['pictures'] as $p) {
            $out[] = '<picture>' . x($p) . '</picture>';
        }
        $out[] = '<description>' . x($r['description']) . '</description>';
        foreach ($r['params'] as $name => $value) {
            $out[] = '<param name="' . x((string) $name) . '">' . x((string) $value) . '</param>';
        }
        $out[] = '</offer>';
    }

    $out[] = '</offers>';
    $out[] = '</shop>';
    $out[] = '</yml_catalog>';

    return implode("\n", $out);
}

/**
 * Тот же каталог таблицей — на случай, если товары придётся заводить файлом,
 * а не ссылкой.
 *
 * Точка с запятой и BOM в начале — ради Excel: с запятой он в русской локали
 * сваливает всю строку в одну ячейку, без BOM показывает кириллицу кракозябрами.
 * Оба лечатся в самом Excel руками, но объяснять это каждый раз дороже, чем
 * отдать файл, который просто открывается.
 */
function feed2gisCsv(array $catalog): string
{
    [$rows] = gisRows($catalog);

    $head = [
        'Артикул', 'Название', 'Категория', 'Цена, ₽', 'Валюта',
        'Описание', 'Ссылка на товар', 'Фото',
    ];

    $fh = fopen('php://temp', 'r+');
    fputcsv($fh, $head, ';', '"', '');
    foreach ($rows as $r) {
        fputcsv($fh, [
            $r['id'],
            $r['name'],
            $r['category'],
            $r['price'],
            'RUB',
            $r['description'],
            $r['url'],
            implode(' ', $r['pictures']),
        ], ';', '"', '');
    }
    rewind($fh);
    $csv = (string) stream_get_contents($fh);
    fclose($fh);

    return "\xEF\xBB\xBF" . $csv;
}
