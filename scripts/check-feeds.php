<?php
/**
 * Проверка товарных фидов на заранее заданном каталоге.
 *
 * Фид ломается тихо: файл отдаётся, площадка его забирает и молча отклоняет
 * часть товаров — а узнаём мы об этом через неделю по пустой витрине. Поэтому
 * сборку гоняем на каталоге, куда нарочно положены все грабли, которые уже
 * встречались в живых данных: машина без фото, машина без цены, марка в разном
 * регистре, мусор в поле комплектации, телефон в описании.
 *
 * Запуск: php scripts/check-feeds.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../public/feed/2gis-build.php';
require_once __DIR__ . '/../public/feed/marquiz-build.php';
require_once __DIR__ . '/../public/feed/marquiz-segments-build.php';

$failures = [];

function check(string $what, bool $ok, string $detail = ''): void
{
    global $failures;
    if (!$ok) {
        $failures[] = $what . ($detail !== '' ? ": {$detail}" : '');
    }
}

/** Каталог с граблями. */
$catalog = [
    [
        'id' => 'tg-2875062656-17',
        'model' => 'Kia K3',
        'year' => 2026,
        'country' => 'kr',
        'engine' => '1,5 л · 115 л.с.',
        'trim' => 'Comfort Edition',
        'mileage' => 'Новый, 0 км',
        'mileageKm' => 0,
        'gearbox' => 'АКПП',
        'drive' => 'Передний',
        'bodyType' => 'Седан',
        'fuelType' => 'Бензин',
        'engineCc' => 1498,
        'powerHp' => 115,
        'color' => 'Серый',
        'addedAt' => 1756000000000,
        'priceRub' => 1830000,
        'priceTverRub' => 1810000,
        'priceMoscowRub' => 1800000,
        'images' => ['https://diauto-bot.d-karatsapov.workers.dev/api/tgphoto?id=AAA'],
        'description' => 'Пишите в телеграм @diavto69 или звоните +7 (999) 123-45-67. #корея',
    ],
    [
        // Та же марка другим регистром — не должна дать второй раздел.
        'id' => 'tg-2875062656-18',
        'model' => 'KIA Sorento',
        'year' => 2023,
        'country' => 'kr',
        'mileage' => '23 000 км',
        'mileageKm' => 23000,
        // Добавлена позже соседки — в подборке Marquiz должна идти первой.
        'addedAt' => 1757000000000,
        'gearbox' => 'АКПП',
        'drive' => 'Полный',
        'priceRub' => 4200000,
        'images' => ['/api/tgphoto?id=BBB', '/api/tgphoto?id=CCC'],
        // Мусор вместо комплектации — в заголовок попасть не должен.
        'trim' => 'оснащена тремя блокировками дифференциалов',
        'description' => '',
    ],
    [
        // Без фотографии — витрина такой товар показать не сможет.
        'id' => 'tg-2875062656-19',
        'model' => 'BMW X5',
        'year' => 2022,
        'priceRub' => 7000000,
        'images' => [],
    ],
    [
        // Без цены.
        'id' => 'tg-2875062656-20',
        'model' => 'Audi Q7',
        'year' => 2024,
        'priceRub' => 0,
        'images' => ['/api/tgphoto?id=DDD'],
    ],
];

// --- YML ---

$xml = feed2gisXml($catalog, '2026-08-26 18:00');

$prev = libxml_use_internal_errors(true);
$doc = simplexml_load_string($xml);
libxml_use_internal_errors($prev);
check('YML не разбирается как XML', $doc !== false);

if ($doc === false) {
    fwrite(STDERR, "фид невалиден, дальше проверять нечего\n");
    exit(1);
}

$offers = $doc->shop->offers->offer;
check('в фид попали не те товары', count($offers) === 2, 'офферов: ' . count($offers));

$ids = [];
foreach ($offers as $o) {
    $ids[] = (string) $o['id'];
}
check(
    'машина без фото или без цены не отсеяна',
    $ids === ['tg-2875062656-17', 'tg-2875062656-18'],
    implode(', ', $ids),
);

// Разделы: корневой + одна марка (Kia в двух написаниях — это одна марка).
$cats = $doc->shop->categories->category;
check('марка в разном регистре развела разделы', count($cats) === 2, 'разделов: ' . count($cats));

$catIds = [];
foreach ($cats as $c) {
    $catIds[] = (string) $c['id'];
}
check('разделы получили одинаковый id', count($catIds) === count(array_unique($catIds)));

// Каждый оффер лежит в существующем разделе.
foreach ($offers as $o) {
    check(
        'оффер ссылается на несуществующий раздел',
        in_array((string) $o->categoryId, $catIds, true),
        (string) $o->categoryId,
    );
}

$first = $offers[0];

/*
 * Цена в фиде должна совпадать с той, что показывает сайт, — до Москвы.
 * Разная цена в объявлении и на сайте — первый повод усомниться в остальных
 * цифрах, даже когда расхождение в пользу покупателя.
 */
check('взята не московская цена', (string) $first->price === '1800000', (string) $first->price);

check(
    'комплектация не попала в заголовок',
    (string) $first->name === 'Kia K3 2026, Comfort Edition',
    (string) $first->name,
);

check(
    'мусор из поля комплектации попал в заголовок',
    (string) $offers[1]->name === 'KIA Sorento 2023',
    (string) $offers[1]->name,
);

$desc = (string) $first->description;
check('телефон остался в описании', !preg_match('/\d{3}[\s-]*\d{2}[\s-]*\d{2}/u', $desc), $desc);
check('ник остался в описании', !str_contains($desc, '@'), $desc);
check('хештег остался в описании', !str_contains($desc, '#'), $desc);
check('описание не рассказывает про саму машину', str_contains($desc, '115 л.с.'), $desc);

// От предложения с телефоном не должно остаться огрызка «Пишите … или
// звоните» — оно выбрасывается целиком, а на его место встаёт обычный текст.
check('от вырезанных контактов остался огрызок', !str_contains($desc, 'звоните'), $desc);
check('вместо вырезанного текста ничего не подставили', str_contains($desc, 'под ключ'), $desc);

check('аббревиатура коробки понижена до строчных', str_contains($desc, 'АКПП'), $desc);
foreach (preg_split('/(?<=\.)\s+/u', $desc) as $s) {
    $s = trim($s);
    check(
        'предложение начинается со строчной буквы',
        $s === '' || mb_substr($s, 0, 1) !== mb_strtolower(mb_substr($s, 0, 1), 'UTF-8'),
        $s,
    );
}
check(
    'описание длиннее потолка',
    mb_strlen($desc) <= GIS_MAX_DESCRIPTION,
    (string) mb_strlen($desc),
);

// У машины со стёртым описанием должен остаться осмысленный текст.
check(
    'пустое описание оставили пустым',
    mb_strlen((string) $offers[1]->description) > 40,
    (string) $offers[1]->description,
);

foreach ($offers as $o) {
    check('у товара нет фотографии', count($o->picture) > 0, (string) $o['id']);
    foreach ($o->picture as $p) {
        check(
            'фото ведёт на заблокированный в России домен воркера',
            !str_contains((string) $p, 'workers.dev'),
            (string) $p,
        );
        check(
            'адрес фотографии не абсолютный',
            str_starts_with((string) $p, 'https://'),
            (string) $p,
        );
    }
    check(
        'ссылка на товар ведёт не на карточку',
        str_contains((string) $o->url, '/catalog?car='),
        (string) $o->url,
    );
    check('у товара нет ни одной характеристики', count($o->param) > 0, (string) $o['id']);
}

// --- CSV ---

$csv = feed2gisCsv($catalog);
check('в CSV нет BOM — Excel покажет кракозябры', str_starts_with($csv, "\xEF\xBB\xBF"));

$lines = array_values(array_filter(explode("\n", trim(substr($csv, 3)))));
check('в CSV не те строки', count($lines) === 3, 'строк: ' . count($lines));
check('в CSV не тот разделитель', substr_count($lines[0], ';') >= 7, $lines[0]);

// --- Marquiz ---

/*
 * Файл для квиза проверяем строже, чем остальные фиды: его загружают руками
 * и результат видят сразу, но ошибку формата Marquiz показывает одной строкой
 * «не удалось импортировать», без подробностей.
 */
$mq = feedMarquizCsv($catalog);
check('в файле Marquiz нет BOM — Excel покажет кракозябры', str_starts_with($mq, "\xEF\xBB\xBF"));

$mqLines = array_values(array_filter(explode("\n", trim(substr($mq, 3)))));
check(
    'в файле Marquiz не те строки',
    count($mqLines) === count(marquizRows($catalog)) + 1,
    'строк: ' . count($mqLines),
);

// Заголовки должны совпасть с полями Marquiz дословно, иначе колонки
// придётся сопоставлять руками при каждой загрузке.
check(
    'заголовки колонок Marquiz изменились',
    str_getcsv(rtrim($mqLines[0], "\r"), ';', '"', '') === [
        'Название', 'Внутреннее название', 'Описание', 'Цена', 'Изображения', 'Видео',
    ],
    $mqLines[0],
);

$mqRows = marquizRows($catalog);
check('в подборку Marquiz попала машина без фото или цены', count($mqRows) === 2, 'строк: ' . count($mqRows));

foreach ($mqRows as $r) {
    check('в названии для Marquiz осталась мусорная комплектация', !str_contains($r['name'], 'блокировк'), $r['name']);
    check('у товара Marquiz нет внутреннего названия', $r['slug'] !== '', $r['name']);
    check('у товара Marquiz нет цены', $r['price'] > 0, $r['name']);
    check('у товара Marquiz нет фотографий', count($r['images']) > 0, $r['name']);
    check(
        'фотографии Marquiz не абсолютными ссылками',
        !array_filter($r['images'], fn($i) => !str_starts_with($i, 'http')),
        implode(' ', $r['images']),
    );
    /*
     * Ссылку в описании Marquiz показывает голым текстом, по которому нельзя
     * кликнуть, а число цены спорит с той ценой, что он печатает сам и умеет
     * зачеркнуть под скидку. Обе вещи уже однажды попали в карточку.
     */
    check('в описании Marquiz появилась ссылка', !str_contains($r['description'], 'http'), $r['name']);
    check(
        'в описании Marquiz появилось число цены',
        !preg_match('/\d[\d\s\x{00a0}]{5,}\s*₽/u', $r['description']),
        $r['description'],
    );
    check(
        'в описании Marquiz потерялось «под ключ»',
        str_contains($r['description'], 'под ключ'),
        $r['name'],
    );
    // Перевод строки внутри поля рвёт наивный разбор CSV на стороне площадки.
    check('в описании Marquiz перевод строки', !str_contains($r['description'], "\n"), $r['name']);
    check(
        'в описании Marquiz остались контакты',
        !preg_match('/@[a-z0-9_]{3,}|\+7\s*\(/iu', $r['description']),
        $r['description'],
    );
}

// Порядок — от новых к старым: при обрезке до лимита должны уходить старые.
check(
    'подборка Marquiz не отсортирована по дате добавления',
    $mqRows[0]['slug'] === 'tg-2875062656-18',
    $mqRows[0]['slug'],
);

// --- Подборки по цене для Marquiz ---

/*
 * Подборки существуют потому, что правила показа задаются в Marquiz руками,
 * и настроить их можно только на нескольких результатах. Значит цена ошибки
 * здесь выше обычной: разойдись границы с вариантами ответа в квизе — и
 * человек увидит подборку, собранную не по его ответу.
 */
$segments = segmentRows($catalog);
check('подборок по цене не то количество', count($segments) === 2, 'подборок: ' . count($segments));

$byId = [];
foreach ($segments as $s) {
    $byId[$s['slug']] = $s;
}
check('нет подборки 1,5–2,5 млн', isset($byId['price-1500-2500']));
check('нет подборки от 3,5 млн', isset($byId['price-3500']));
check(
    'пустая вилка попала в подборки',
    !isset($byId['price-0-1500']) && !isset($byId['price-2500-3500']),
    implode(', ', array_keys($byId)),
);

foreach ($segments as $s) {
    check('в подборке нет машин', $s['count'] > 0, $s['name']);
    check('у подборки нет фотографий', count($s['images']) > 0, $s['name']);
    check('у подборки нет цены', $s['price'] > 0, $s['name']);
    check('в описании подборки ссылка', !str_contains($s['description'], 'http'), $s['name']);
    check(
        'в описании подборки число цены',
        !preg_match('/\d[\d\s\x{00a0}]{5,}\s*₽/u', $s['description']),
        $s['description'],
    );
    check(
        'ссылка подборки ведёт не в каталог',
        str_starts_with($s['url'], SITE_URL . '/catalog'),
        $s['url'],
    );
}

// Цена подборки — нижняя граница того, что в ней лежит: с неё начинается выбор.
check(
    'цена подборки не минимальная',
    $byId['price-1500-2500']['price'] === 1800000,
    (string) $byId['price-1500-2500']['price'],
);
// Число в названии должно склоняться: «1 автомобиль», а не «1 автомобилей».
check('число в названии подборки не склоняется', str_contains($byId['price-3500']['name'], '1 автомобиль'), $byId['price-3500']['name']);
foreach ([1 => 'автомобиль', 2 => 'автомобиля', 5 => 'автомобилей', 11 => 'автомобилей', 22 => 'автомобиля', 101 => 'автомобиль'] as $n => $word) {
    check('склонение «автомобиль» сломано', carsWord($n) === $n . ' ' . $word, carsWord($n));
}

$segCsv = feedMarquizSegmentsCsv($catalog);
$segLines = array_values(array_filter(explode("\n", trim(substr($segCsv, 3)))));
check('в файле подборок не те строки', count($segLines) === count($segments) + 1, 'строк: ' . count($segLines));
check(
    'заголовки файла подборок разошлись с файлом машин',
    str_getcsv(rtrim($segLines[0], "\r"), ';', '"', '') === [
        'Название', 'Внутреннее название', 'Описание', 'Цена', 'Изображения', 'Видео',
    ],
    $segLines[0],
);

// --- Фид Яндекса: все ли вызовы разрешимы ---

/*
 * Общая часть фидов вынесена в catalog-source.php уже после того, как фид
 * Яндекса год проработал. Такой перенос ломается тихо: пропустил один вызов
 * при переносе — файл проходит проверку синтаксиса, выкладывается, и падает
 * только когда за ним придёт робот. Прогнать сам yandex.php тестом нельзя:
 * он с первой строки лезет в сеть за каталогом. Поэтому проверяем иначе —
 * что каждая функция, которую он зовёт, где-то объявлена.
 */
$yandexSrc = (string) file_get_contents(__DIR__ . '/../public/feed/yandex.php');
$sharedSrc = (string) file_get_contents(__DIR__ . '/../public/feed/catalog-source.php');

/** Имена функций, объявленных в исходнике. */
function declaredIn(string $src): array
{
    preg_match_all('/\bfunction\s+([a-z_][a-z0-9_]*)\s*\(/i', $src, $m);
    return $m[1];
}

$known = array_merge(declaredIn($yandexSrc), declaredIn($sharedSrc));

// Вызовы вида «имя(» — за вычетом объявлений, ключевых слов и методов.
preg_match_all('/(?<![\$>:\w])([a-z_][a-z0-9_]*)\s*\(/i', $yandexSrc, $calls);
$keywords = [
    'if', 'for', 'foreach', 'while', 'switch', 'catch', 'function', 'fn',
    'return', 'echo', 'print', 'array', 'list', 'isset', 'unset', 'empty',
    'match', 'exit', 'die', 'require', 'require_once', 'include', 'include_once',
    'elseif', 'and', 'or', 'use', 'new', 'declare', 'throw', 'clone', 'yield',
];

foreach (array_unique($calls[1]) as $fn) {
    if (in_array(strtolower($fn), $keywords, true) || in_array($fn, $known, true)) {
        continue;
    }
    check(
        'фид Яндекса зовёт функцию, которой нигде нет',
        function_exists($fn),
        $fn . '()',
    );
}

// Константы, оставшиеся в yandex.php после переноса, тоже должны быть объявлены.
foreach (['WORKER', 'SITE_URL', 'SHOP_NAME', 'COMPANY', 'COUNTRIES', 'ROOT_CATEGORY_ID'] as $c) {
    check('константа фида не объявлена', defined($c), $c);
}

// --- Итог ---

if ($failures) {
    fwrite(STDERR, "Фиды: найдены проблемы\n");
    foreach ($failures as $f) {
        fwrite(STDERR, "  • {$f}\n");
    }
    exit(1);
}

echo "Фиды: проверено, замечаний нет\n";
