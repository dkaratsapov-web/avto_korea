<?php
/**
 * Раздел «Бот» — админка Telegram-бота внутри CRM.
 *
 * Не копия данных, а второй пульт к тем же данным. Каталог, заявки,
 * настройки, отзывы, подписки, статистика, рассылка и админы живут у бота;
 * мини-апп и CRM вызывают одни и те же действия бота, поэтому правка в одном
 * месте сразу видна в другом — синхронизировать нечего.
 *
 * Ключ — отдельный от ключа отзывов: тот узкий, этот полный. Владелец берёт
 * его в боте командой /crm_admin. Пользоваться разделом может только
 * владелец CRM: ключ даёт права владельца бота.
 */

declare(strict_types=1);

/** Адрес воркера с ботом — тот же, что в routes/reviews.php. */
const CRM_BOT_ADMIN_ORIGIN = 'https://diauto-bot.d-karatsapov.workers.dev';

function crm_bot_admin_key(): string
{
    return trim((string) (crm_settings()['botAdminKey'] ?? ''));
}

/**
 * Ссылки на файлы бота — на свой домен.
 *
 * Домен воркера (*.workers.dev) у российских провайдеров закрыт, а сайт
 * отдаёт те же файлы со своего адреса через public/api/proxy.php.
 */
function crm_bot_localize(mixed $value): mixed
{
    if (is_string($value)) {
        return str_replace(CRM_BOT_ADMIN_ORIGIN . '/api/', '/api/', $value);
    }
    if (is_array($value)) {
        foreach ($value as $k => $v) {
            $value[$k] = crm_bot_localize($v);
        }
    }
    return $value;
}

/**
 * Вызов действия админки бота.
 *
 * Ответ бота отдаётся интерфейсу как есть: отказ в конкретном действии
 * (например, «нет такого черновика») админка показывает сама. Ошибкой CRM
 * становятся только связь и ключ — там интерфейсу нечего показать.
 */
function crm_bot_call(string $key, string $action, mixed $payload = null): array
{
    if (!function_exists('curl_init')) {
        crm_fail(500, 'no_curl', 'На хостинге нет curl — запрос к боту невозможен');
    }

    $ch = curl_init(CRM_BOT_ADMIN_ORIGIN . '/api/crm');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(
            ['action' => $action, 'payload' => $payload],
            JSON_UNESCAPED_UNICODE,
        ),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Crm-Key: ' . $key],
        CURLOPT_RETURNTRANSFER => true,
        // Рассылка по подписчикам и сохранение большого каталога идут дольше
        // обычного запроса.
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if (!is_string($raw)) {
        crm_fail(502, 'bot_unreachable', 'Бот не ответил. Повторите через минуту');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        crm_fail(502, 'bot_bad_response', 'Бот ответил непонятно');
    }
    if ($status === 401) {
        crm_fail(
            422,
            (string) ($data['error'] ?? 'bad_key'),
            'Бот не принял ключ. Возьмите его командой /crm_admin',
        );
    }

    return crm_bot_localize($data);
}

function crm_route_bot(string $method, array $path): void
{
    $action = $path[0] ?? '';
    crm_require_owner();

    // --- подключено ли ---
    if ($action === '' && $method === 'GET') {
        $key = crm_bot_admin_key();
        if ($key === '') {
            crm_json(['ok' => true, 'connected' => false]);
        }
        $me = crm_bot_call($key, 'me');
        crm_json(['ok' => true, 'connected' => ($me['ok'] ?? false) === true]);
    }

    // --- подключение ключом из бота ---
    if ($action === 'key' && $method === 'POST') {
        $key = crm_str(crm_body(), 'key', 190);
        if ($key === '') {
            crm_save_settings(['botAdminKey' => '']);
            crm_json(['ok' => true, 'connected' => false]);
        }
        // Проверяем ДО сохранения: «подключено» с неверным ключом хуже, чем отказ.
        $me = crm_bot_call($key, 'me');
        if (($me['ok'] ?? false) !== true || ($me['owner'] ?? false) !== true) {
            crm_fail(422, 'bad_key', 'Это не полный ключ. Возьмите его командой /crm_admin');
        }
        crm_save_settings(['botAdminKey' => $key]);
        crm_json(['ok' => true, 'connected' => true]);
    }

    // --- действие админки бота ---
    if ($action === 'call' && $method === 'POST') {
        $key = crm_bot_admin_key();
        if ($key === '') {
            crm_fail(409, 'not_connected', 'Раздел не подключён к боту');
        }
        $body = crm_body();
        $name = crm_str($body, 'action', 60);
        if ($name === '' || !preg_match('/^[a-z]+(\.[a-z]+)?$/', $name)) {
            crm_fail(400, 'bad_action', 'Неизвестное действие');
        }
        crm_json(crm_bot_call($key, $name, $body['payload'] ?? null));
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела «Бот»');
}
