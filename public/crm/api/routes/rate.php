<?php
/**
 * Курс валюты от ЦБ РФ.
 *
 * За курсом ходит сервер, а не браузер менеджера: так запрос не зависит от
 * доступности стороннего сервиса из чужой сети и не упирается в CORS.
 * Ответ кэшируется на час — курс меняется раз в сутки.
 */

declare(strict_types=1);

const CRM_RATES_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

function crm_route_rate(string $method, array $path): void
{
    if ($method !== 'GET') {
        crm_fail(404, 'not_found', 'Неизвестный метод');
    }
    crm_require_user();

    $currency = strtoupper(mb_substr(trim((string) ($_GET['currency'] ?? '')), 0, 8));
    if ($currency === '') {
        crm_fail(422, 'no_currency', 'Не указана валюта');
    }
    if ($currency === 'RUB') {
        crm_json(['ok' => true, 'currency' => 'RUB', 'rate' => 1, 'date' => null]);
    }

    $data = crm_fetch_rates();
    if ($data === null) {
        crm_fail(
            502,
            'rates_unavailable',
            'Не удалось получить курс ЦБ — проверьте связь и введите курс вручную',
        );
    }

    $parsed = crm_parse_rate($data, $currency);
    if ($parsed === null) {
        crm_fail(404, 'no_rate', 'ЦБ не публикует курс для ' . $currency);
    }

    crm_json(['ok' => true] + $parsed);
}

/**
 * Курс валюты к рублю из ответа ЦБ.
 *
 * В ответе значение указано за номинал (100 иен, 1000 вон), а в CRM курс
 * всегда за одну единицу — поэтому делим на Nominal.
 */
function crm_parse_rate(array $data, string $currency): ?array
{
    $valute = $data['Valute'][$currency] ?? null;
    if (!is_array($valute)) {
        return null;
    }

    $nominal = (int) ($valute['Nominal'] ?? 1);
    if ($nominal <= 0) {
        $nominal = 1;
    }

    $value = $valute['Value'] ?? null;
    if (!is_numeric($value) || (float) $value <= 0) {
        return null;
    }

    return [
        'currency' => $currency,
        // Четыре знака — столько же хранит поле курса в базе.
        'rate' => round((float) $value / $nominal, 4),
        'date' => $data['Date'] ?? null,
    ];
}

/** Ответ ЦБ с часовым кэшем на диске. */
function crm_fetch_rates(): ?array
{
    $cache = sys_get_temp_dir() . '/crm-cbr.json';

    if (is_file($cache) && filemtime($cache) > time() - 3600) {
        $cached = json_decode((string) @file_get_contents($cache), true);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $raw = crm_http_get(CRM_RATES_URL);
    if ($raw === null) {
        return null;
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['Valute'])) {
        return null;
    }

    @file_put_contents($cache, $raw, LOCK_EX);
    return $data;
}

function crm_http_get(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return is_string($body) && $code >= 200 && $code < 300 ? $body : null;
    }

    $context = stream_context_create(['http' => ['timeout' => 8]]);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : null;
}
