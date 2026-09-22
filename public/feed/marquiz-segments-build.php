<?php
/**
 * Сборка подборок по цене для результатов квиза Marquiz.
 *
 * ЗАЧЕМ ЭТО ВМЕСТО МАШИН. Импорт каталога загружает карточки, но не правила:
 * какая машина под какой ответ — задаётся в самом Marquiz, у каждого
 * результата отдельно. На трёхстах машинах, которые живут до продажи две-три
 * недели, это не настраивается вовсе, и квиз показывает подборку невпопад.
 * Подборок же всего четыре, они совпадают с вариантами вопроса про бюджет,
 * и условие у каждой одно. Настроил один раз — работает всегда.
 *
 * Содержимое при этом живое: сколько машин, какие страны, какие модели и
 * почём — всё пересчитывается из каталога при каждой сборке.
 *
 * Вилки повторяют варианты ответа в квизе дословно. Разойдутся они — и
 * человек, выбравший «1,5–2,5 млн», увидит подборку, собранную по другим
 * границам; поэтому менять их можно только вместе с вопросом.
 */

declare(strict_types=1);

require_once __DIR__ . '/catalog-source.php';
require_once __DIR__ . '/2gis-build.php';
require_once __DIR__ . '/marquiz-build.php';

/** Фотографий в карточке подборки: по одной с разных машин. */
const SEGMENT_MAX_PICTURES = 5;

/** Сколько моделей называем для примера. */
const SEGMENT_EXAMPLES = 3;

/**
 * Вилки цены — дословно как в вопросе квиза «Какой у вас бюджет?».
 *
 * Границы полуинтервальные: нижняя включается, верхняя нет. Машина ровно за
 * 2 500 000 ₽ попадает в «2,5–3,5», а не в обе подборки сразу.
 */
const PRICE_SEGMENTS = [
    ['slug' => 'price-0-1500', 'title' => 'До 1,5 млн ₽', 'from' => 0, 'to' => 1500000],
    ['slug' => 'price-1500-2500', 'title' => 'От 1,5 до 2,5 млн ₽', 'from' => 1500000, 'to' => 2500000],
    ['slug' => 'price-2500-3500', 'title' => 'От 2,5 до 3,5 млн ₽', 'from' => 2500000, 'to' => 3500000],
    ['slug' => 'price-3500', 'title' => 'От 3,5 млн ₽', 'from' => 3500000, 'to' => PHP_INT_MAX],
];

/** «139 автомобилей», «1 автомобиль», «22 автомобиля». */
function carsWord(int $n): string
{
    $mod100 = $n % 100;
    $mod10 = $n % 10;
    if ($mod100 >= 11 && $mod100 <= 14) {
        return $n . ' автомобилей';
    }
    if ($mod10 === 1) {
        return $n . ' автомобиль';
    }
    if ($mod10 >= 2 && $mod10 <= 4) {
        return $n . ' автомобиля';
    }
    return $n . ' автомобилей';
}

/**
 * Описание подборки: что внутри и почём.
 *
 * Человек выбрал вилку цены — значит остальное для него ещё открыто, и
 * карточка должна отвечать на «а что там вообще есть»: сколько машин, новые
 * или с пробегом, откуда и что за модели. Общими словами тут не отделаться:
 * «большой выбор автомобилей» не говорит ничего, а «65 новых и 74 с пробегом»
 * говорит всё.
 */
function segmentDescription(array $cars): string
{
    $new = 0;
    $countries = [];
    $models = [];

    foreach ($cars as $c) {
        if ((int) ($c['mileageKm'] ?? 0) === 0) {
            $new++;
        }
        $country = COUNTRIES[(string) ($c['country'] ?? '')] ?? '';
        if ($country !== '') {
            $countries[$country] = ($countries[$country] ?? 0) + 1;
        }
        [$vendor, $model] = splitModel((string) ($c['model'] ?? ''));
        $name = trim($vendor . ' ' . $model);
        if ($name !== '') {
            $models[$name] = ($models[$name] ?? 0) + 1;
        }
    }

    $used = count($cars) - $new;
    $parts = [carsWord(count($cars)) . ' в наличии и в пути'];

    if ($new && $used) {
        $parts[] = $new . ' новых и ' . $used . ' с пробегом';
    } elseif ($new) {
        $parts[] = 'все новые';
    } elseif ($used) {
        $parts[] = 'все с пробегом';
    }

    // Страны по убыванию: первая — та, которой в подборке действительно много.
    arsort($countries);
    if ($countries) {
        $parts[] = implode(', ', array_keys($countries));
    }

    // Примеры моделей берём самые частые: они и характеризуют подборку.
    arsort($models);
    $examples = array_slice(array_keys($models), 0, SEGMENT_EXAMPLES);
    if ($examples) {
        $parts[] = 'например ' . implode(', ', $examples);
    }

    $text = implode('. ', array_map('ucfirst_u', $parts)) . '.';

    /*
     * Вилку словами не повторяем. Она уже стоит в названии подборки, а нижнюю
     * границу Marquiz печатает сам отдельной строкой и умеет зачеркнуть её,
     * показав скидку: названное здесь число спорило бы с ценой над ним — ровно
     * та же беда, из-за которой суммы убраны из карточек машин.
     */
    $text .= ' Цена под ключ: доставка, таможня, утильсбор и ЭПТС уже внутри.';

    return $text;
}

/**
 * Адрес живой подборки на сайте — для кнопки результата.
 *
 * Сам файл эту ссылку не несёт: колонки для неё в формате нет, а в описании
 * Marquiz показывает её голым текстом. Поэтому ссылки отдаём списком рядом,
 * и их проставляют кнопкам руками — один раз на четыре подборки.
 */
function segmentUrl(array $seg): string
{
    $p = [];
    if ($seg['from'] > 0) {
        $p['priceFrom'] = $seg['from'];
    }
    if ($seg['to'] !== PHP_INT_MAX) {
        $p['priceTo'] = $seg['to'];
    }
    return SITE_URL . '/catalog' . ($p ? '?' . http_build_query($p) : '');
}

/**
 * Строки подборок. Пустые вилки пропускаем: карточка «0 автомобилей» хуже,
 * чем её отсутствие — человек выбрал этот ответ и упёрся в пустоту.
 */
function segmentRows(array $catalog): array
{
    // Годными считаем те же машины, что уходят в обычную выгрузку: с ценой,
    // названием и хотя бы одной фотографией.
    $cars = [];
    foreach ($catalog as $c) {
        if (!is_array($c)) {
            continue;
        }
        $images = array_values(array_filter(
            (array) ($c['images'] ?? []),
            fn($i) => is_string($i) && $i !== '',
        ));
        if (feedPrice($c) <= 0 || empty($c['id']) || empty($c['model']) || !$images) {
            continue;
        }
        $c['images'] = $images;
        $cars[] = $c;
    }

    $rows = [];
    foreach (PRICE_SEGMENTS as $seg) {
        $inside = array_values(array_filter(
            $cars,
            fn($c) => feedPrice($c) >= $seg['from'] && feedPrice($c) < $seg['to'],
        ));
        if (!$inside) {
            continue;
        }

        // Сначала дорогие: на витрине подборки лучше смотрятся машины
        // верхней части вилки, а не самые дешёвые из неё.
        usort($inside, fn($a, $b) => feedPrice($b) <=> feedPrice($a));

        // По одной фотографии с разных машин — карточка должна читаться как
        // подборка, а не как один автомобиль с пяти ракурсов.
        $images = [];
        foreach ($inside as $c) {
            $images[] = abs_url($c['images'][0]);
            if (count($images) >= SEGMENT_MAX_PICTURES) {
                break;
            }
        }

        $rows[] = [
            'name' => $seg['title'] . ' — ' . carsWord(count($inside)),
            'slug' => $seg['slug'],
            'description' => segmentDescription($inside),
            // Нижняя граница подборки: Marquiz печатает её как цену, и это
            // ровно то, с чего в подборке начинается выбор.
            'price' => min(array_map('feedPrice', $inside)),
            'images' => $images,
            'video' => '',
            'url' => segmentUrl($seg),
            'count' => count($inside),
        ];
    }

    return $rows;
}

/** Тот же CSV, что и для машин: колонки Marquiz не меняются. */
function feedMarquizSegmentsCsv(array $catalog): string
{
    $head = ['Название', 'Внутреннее название', 'Описание', 'Цена', 'Изображения', 'Видео'];

    $fh = fopen('php://temp', 'r+');
    fputcsv($fh, $head, ';', '"', '');
    foreach (segmentRows($catalog) as $r) {
        fputcsv($fh, [
            $r['name'],
            $r['slug'],
            $r['description'],
            $r['price'],
            implode('|', $r['images']),
            $r['video'],
        ], ';', '"', '');
    }
    rewind($fh);
    $csv = (string) stream_get_contents($fh);
    fclose($fh);

    return "\xEF\xBB\xBF" . $csv;
}

/** Памятка: какой подборке какое условие и какая ссылка на кнопке. */
function segmentsReadme(array $catalog): string
{
    $out = [
        '# Подборки по цене для квиза Marquiz',
        '',
        'Загрузите файл в «Импорт результатов», затем у каждого результата',
        'задайте одно условие по первому вопросу и одну ссылку на кнопку.',
        '',
        '| Результат | Условие: ответ на «Какой у вас бюджет?» | Ссылка на кнопке |',
        '| --- | --- | --- |',
    ];

    $answers = [
        'price-0-1500' => 'До 1,5 млн рублей',
        'price-1500-2500' => '1,5 – 2,5 млн рублей',
        'price-2500-3500' => '2,5 – 3,5 млн рублей',
        'price-3500' => 'Более 3,5 млн',
    ];

    foreach (segmentRows($catalog) as $r) {
        $out[] = '| ' . $r['name'] . ' | ' . ($answers[$r['slug']] ?? '—') . ' | ' . $r['url'] . ' |';
    }

    $out[] = '';
    $out[] = 'Кнопка ведёт в каталог с уже выставленным фильтром по цене:';
    $out[] = 'подборка там живая, проданные машины уходят из неё сами.';

    return implode("\n", $out) . "\n";
}
