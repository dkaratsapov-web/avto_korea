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
 * Вилки повторяют варианты ответа в квизе дословно — вплоть до подписи,
 * которая лежит тут же, в поле answer, и попадает в памятку по настройке.
 * Разойдутся они с квизом — и человек, выбравший «2–3 млн», увидит подборку,
 * собранную по другим границам; поэтому менять их можно только вместе
 * с вопросом.
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
    ['slug' => 'price-0-2000', 'title' => 'До 2 млн ₽', 'from' => 0, 'to' => 2000000, 'answer' => 'До 2 млн рублей'],
    ['slug' => 'price-2000-3000', 'title' => 'От 2 до 3 млн ₽', 'from' => 2000000, 'to' => 3000000, 'answer' => '2 - 3 млн рублей'],
    ['slug' => 'price-3000-4000', 'title' => 'От 3 до 4 млн ₽', 'from' => 3000000, 'to' => 4000000, 'answer' => '3 - 4 млн рублей'],
    ['slug' => 'price-4000', 'title' => 'От 4 млн ₽', 'from' => 4000000, 'to' => PHP_INT_MAX, 'answer' => 'Более 4 млн'],
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
    $text .= ' Цена под ключ, с доставкой и растаможкой.';

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
        if (!feedCarOk($c) || !$images) {
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
            'answer' => $seg['answer'],
            'count' => count($inside),
        ];
    }

    return $rows;
}

/**
 * Машины одной вилки — файлом для загрузки в соответствующий сегмент.
 *
 * В Marquiz правила показа живут в сегментах: результаты создаются внутри
 * сегмента, а у сегмента задано условие по ответу. Значит машины можно
 * раскладывать по сегментам напрямую — и тогда человек видит в результате не
 * обобщённую подборку, а настоящие автомобили своей вилки.
 *
 * Файл на сегмент отдельный, потому что импорт грузит результаты в тот
 * сегмент, который открыт на экране: один общий файл свалил бы весь каталог
 * в первый же.
 */
function marquizRowsInSegment(array $catalog, string $slug): array
{
    $seg = null;
    foreach (PRICE_SEGMENTS as $s) {
        if ($s['slug'] === $slug) {
            $seg = $s;
            break;
        }
    }
    if (!$seg) {
        return [];
    }

    $inside = array_values(array_filter(
        $catalog,
        fn($c) => is_array($c) && feedPrice($c) >= $seg['from'] && feedPrice($c) < $seg['to'],
    ));

    return marquizRows($inside);
}

/** CSV с машинами одной вилки — колонки те же, что и в общем файле. */
function feedMarquizSegmentCarsCsv(array $catalog, string $slug): string
{
    $head = ['Название', 'Внутреннее название', 'Описание', 'Цена', 'Изображения', 'Видео'];

    $fh = fopen('php://temp', 'r+');
    fputcsv($fh, $head, ';', '"', '');
    foreach (marquizRowsInSegment($catalog, $slug) as $r) {
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

/** Латиница для имени файла: кириллица в именах ломается по дороге. */
function segmentFileName(array $seg): string
{
    return 'сегмент-' . str_replace('price-', '', $seg['slug']);
}

/**
 * Памятка по настройке: что куда грузить и какое условие ставить.
 *
 * Пишется рядом с файлами, потому что порядок действий в Marquiz неочевиден:
 * импорт грузит результаты в тот сегмент, который открыт на экране, а условие
 * задаётся не у результата, а у сегмента. Перепутай порядок — и весь каталог
 * ляжет в первый сегмент, показываясь всем подряд.
 */
function segmentsReadme(array $catalog): string
{
    $out = [
        '# Как разложить каталог по сегментам квиза',
        '',
        'В Marquiz правила показа живут в сегментах: результаты создаются внутри',
        'сегмента, а условие — «какой ответ ведёт в этот сегмент» — задаётся',
        'у самого сегмента. Поэтому порядок такой:',
        '',
        '1. Переименовать сегменты под новые вилки (или создать заново).',
        '2. У каждого сегмента задать условие по вопросу «Какой у вас бюджет?».',
        '3. Открыть сегмент и загрузить в него **его** файл — импорт грузит',
        '   результаты в тот сегмент, который открыт.',
        '4. Включить «Показывать несколько результатов»: в сегменте их много.',
        '',
        '| Сегмент | Условие: ответ на «Какой у вас бюджет?» | Файл | Машин |',
        '| --- | --- | --- | ---: |',
    ];

    $total = 0;
    foreach (PRICE_SEGMENTS as $seg) {
        $n = count(marquizRowsInSegment($catalog, $seg['slug']));
        $total += $n;
        $out[] = '| ' . $seg['title'] . ' | ' . $seg['answer'] . ' | `'
            . segmentFileName($seg) . '.xlsx` | ' . $n . ' |';
    }

    $out[] = '';
    $out[] = 'Всего ' . carsWord($total) . '. Лимит Marquiz — 300 результатов на квиз,';
    $out[] = 'считая все сегменты вместе.';
    $out[] = '';
    $out[] = '## Ссылки для кнопки «Смотреть все»';
    $out[] = '';
    $out[] = 'Кнопка ведёт в каталог с уже выставленным фильтром по цене — там';
    $out[] = 'подборка живая, и проданные машины уходят из неё сами.';
    $out[] = '';
    foreach (PRICE_SEGMENTS as $seg) {
        $out[] = '- ' . $seg['title'] . ' — ' . segmentUrl($seg);
    }
    $out[] = '';
    $out[] = '## Если каталог обновился';
    $out[] = '';
    $out[] = 'Удалить результаты сегмента и загрузить свежий файл. Условие';
    $out[] = 'у сегмента при этом не трогается — оно задано один раз.';

    return implode("\n", $out) . "\n";
}
