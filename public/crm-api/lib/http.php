<?php
/**
 * Разбор запроса и ответы API.
 *
 * Все ответы — JSON. Ошибка всегда несёт машинный код (`error`) и текст для
 * человека (`message`): интерфейс показывает второе, а решения принимает по
 * первому.
 */

declare(strict_types=1);

/** Ответ с данными. */
function crm_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    // CRM не должна попадать ни в поиск, ни в кэш прокси.
    header('Cache-Control: no-store, private');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Ошибка с кодом состояния. */
function crm_fail(int $status, string $error, string $message): never
{
    crm_json(['ok' => false, 'error' => $error, 'message' => $message], $status);
}

/**
 * Ошибка на этапе, когда обычный вывод ещё мог не инициализироваться
 * (нет каталога данных, нет драйвера БД). Отличается от crm_fail только тем,
 * что не рассчитывает на уже загруженное окружение.
 */
function crm_fatal(int $status, string $error, string $message): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'error' => $error, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Тело запроса как массив. Пустое тело — пустой массив, а не ошибка. */
function crm_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return $body = [];
    }
    if (strlen($raw) > 12 * 1024 * 1024) {
        crm_fail(413, 'payload_too_large', 'Слишком большой запрос');
    }

    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        crm_fail(400, 'bad_json', 'Тело запроса не является корректным JSON');
    }

    return $body = $parsed;
}

/** Строковое поле запроса с обрезкой пробелов и ограничением длины. */
function crm_str(array $src, string $key, int $max = 500): string
{
    $value = $src[$key] ?? '';
    if (is_numeric($value)) {
        $value = (string) $value;
    }
    if (!is_string($value)) {
        return '';
    }
    return mb_substr(trim($value), 0, $max);
}

/** Необязательное строковое поле: пустая строка превращается в null. */
function crm_str_or_null(array $src, string $key, int $max = 500): ?string
{
    $value = crm_str($src, $key, $max);
    return $value === '' ? null : $value;
}

/** Целое поле. Нечисловое значение даёт null, а не ноль. */
function crm_int_or_null(array $src, string $key): ?int
{
    $value = $src[$key] ?? null;
    if ($value === null || $value === '' || !is_numeric($value)) {
        return null;
    }
    return (int) $value;
}

/**
 * Денежное поле. Храним и считаем в рублях с двумя знаками: суммы сделки
 * не выходят за пределы, где double считает точно, а округление на входе
 * снимает накопление ошибки.
 */
function crm_money(array $src, string $key): float
{
    $value = $src[$key] ?? 0;
    if (is_string($value)) {
        // Менеджер может ввести «1 200 000,50» — приводим к машинному виду.
        $value = str_replace([' ', "\u{00A0}", ','], ['', '', '.'], $value);
    }
    if (!is_numeric($value)) {
        return 0.0;
    }
    $number = (float) $value;
    if (!is_finite($number)) {
        return 0.0;
    }
    return round(max(0.0, min($number, 1.0e11)), 2);
}

/** Курс валюты — четыре знака после запятой, как в исходной CRM. */
function crm_rate(array $src, string $key): float
{
    $value = $src[$key] ?? 0;
    if (is_string($value)) {
        $value = str_replace([' ', "\u{00A0}", ','], ['', '', '.'], $value);
    }
    if (!is_numeric($value)) {
        return 0.0;
    }
    $number = (float) $value;
    if (!is_finite($number) || $number < 0) {
        return 0.0;
    }
    return round(min($number, 1.0e6), 4);
}

/** Булево поле, терпимое к «1», «true» и «on». */
function crm_bool(array $src, string $key): bool
{
    $value = $src[$key] ?? false;
    if (is_bool($value)) {
        return $value;
    }
    return in_array($value, [1, '1', 'true', 'on', 'yes'], true);
}

/**
 * Дата в формате YYYY-MM-DD. Всё, что не разбирается, считается отсутствующим:
 * лучше пустая дата, чем 1970 год в карточке сделки.
 */
function crm_date_or_null(array $src, string $key): ?string
{
    $value = crm_str($src, $key, 32);
    if ($value === '') {
        return null;
    }
    $date = date_create($value);
    return $date ? $date->format('Y-m-d') : null;
}

/** Значение из списка допустимых. Иначе — ошибка запроса. */
function crm_enum(array $src, string $key, array $allowed, ?string $fallback = null): string
{
    $value = crm_str($src, $key, 64);
    if (in_array($value, $allowed, true)) {
        return $value;
    }
    if ($fallback !== null) {
        return $fallback;
    }
    crm_fail(422, 'bad_value', 'Недопустимое значение поля ' . $key);
}
