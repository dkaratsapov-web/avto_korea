<?php
/**
 * Проверка целостности API CRM.
 *
 * Ищет вызовы функций проекта, которые недоступны из точки входа: файл их
 * вызывает, но не подключает — ни сам, ни через цепочку require.
 *
 * Такая ошибка не видна ни в подсветке, ни при проверке синтаксиса, и не
 * ловится обычным прогоном интерфейса: падение происходит уже ПОСЛЕ записи
 * в базу, поэтому выглядит как «ошибка сервера, но всё сохранилось».
 * Она случалась дважды — с историей сделки и с отправкой push, — поэтому
 * проверка вынесена отдельно и гоняется вместе с тестами.
 *
 * Запуск: php scripts/check-crm-api.php
 */

declare(strict_types=1);

$root = realpath(__DIR__ . '/../public/crm-api');
if ($root === false) {
    fwrite(STDERR, "каталог API не найден\n");
    exit(1);
}

/** Все файлы API. Пути приводим к каноническому виду, иначе граф не сойдётся. */
function crm_files(string $root): array
{
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $files[] = (string) $file->getRealPath();
        }
    }
    sort($files);
    return $files;
}

/**
 * Исходник без строковых литералов и комментариев.
 *
 * Без этого имена таблиц в SQL — «CREATE TABLE crm_users (» — читаются как
 * вызовы функций, и проверка тонет в ложных срабатываниях.
 */
function crm_code_only(string $path): string
{
    $out = '';
    foreach (token_get_all((string) file_get_contents($path)) as $token) {
        if (is_array($token)) {
            $ignored = [
                T_CONSTANT_ENCAPSED_STRING,
                T_ENCAPSED_AND_WHITESPACE,
                T_INLINE_HTML,
                T_COMMENT,
                T_DOC_COMMENT,
            ];
            $out .= in_array($token[0], $ignored, true) ? ' ' : $token[1];
        } else {
            $out .= $token;
        }
    }
    return $out;
}

/** Что файл подключает. Пути вида __DIR__ . '/...' разрешаются в реальные. */
function crm_requires(string $path): array
{
    preg_match_all(
        "/require(?:_once)?\s+__DIR__\s*\.\s*'([^']+)'/",
        (string) file_get_contents($path),
        $matches,
    );

    $found = [];
    foreach ($matches[1] as $relative) {
        $resolved = realpath(dirname($path) . $relative);
        if ($resolved !== false) {
            $found[] = $resolved;
        }
    }
    return $found;
}

/** Какие функции файл объявляет. */
function crm_declares(string $path): array
{
    preg_match_all('/\bfunction\s+(crm_[a-z0-9_]+)/i', crm_code_only($path), $matches);
    return $matches[1];
}

/** Какие функции проекта файл вызывает. */
function crm_calls(string $path): array
{
    $code = crm_code_only($path);
    // Объявления исключаем: «function crm_foo(» — это не вызов.
    $code = preg_replace('/\bfunction\s+crm_[a-z0-9_]+/i', '', $code) ?? $code;

    preg_match_all('/\b(crm_[a-z0-9_]+)\s*\(/i', $code, $matches);
    return array_values(array_unique($matches[1]));
}

/** Замыкание подключений: что доступно файлу с учётом всей цепочки. */
function crm_reachable(string $path, array $graph, array &$seen): array
{
    if (isset($seen[$path])) {
        return [];
    }
    $seen[$path] = true;

    $available = crm_declares($path);
    foreach ($graph[$path] ?? [] as $required) {
        $available = array_merge($available, crm_reachable($required, $graph, $seen));
    }
    return $available;
}

$files = crm_files($root);
$graph = [];
foreach ($files as $file) {
    $graph[$file] = crm_requires($file);
}

// Точка входа подключает базовый набор, и маршруты вызываются уже из неё —
// значит им доступно всё, что она успела загрузить.
$entry = realpath($root . '/index.php');
$seenEntry = [];
$fromEntry = crm_reachable((string) $entry, $graph, $seenEntry);

$problems = [];

foreach ($files as $file) {
    $seen = [];
    $available = crm_reachable($file, $graph, $seen);

    if (str_contains($file, '/routes/')) {
        $available = array_merge($available, $fromEntry);
    }

    foreach (crm_calls($file) as $call) {
        if (!in_array($call, $available, true)) {
            $problems[] = sprintf(
                '%s вызывает %s() — файл с её объявлением не подключён',
                str_replace($root . '/', '', $file),
                $call,
            );
        }
    }
}

if ($problems === []) {
    printf("API CRM: %d файлов, разрывов в подключениях нет\n", count($files));
    exit(0);
}

fwrite(STDERR, "разрывы в подключениях API CRM:\n");
foreach ($problems as $problem) {
    fwrite(STDERR, '  ✗ ' . $problem . "\n");
}
exit(1);
