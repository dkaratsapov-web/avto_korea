<?php
/**
 * Уведомления сотрудникам.
 *
 * Два канала. Telegram — основной: приходит одинаково на любой телефон, ничего
 * ставить не надо, и сообщение остаётся в переписке, так что ночное событие
 * можно пролистать утром. Браузерный push — дополнительный: на айфоне он
 * работает только у сайта, установленного на домашний экран, и может тихо
 * отключиться, если иконку удалят.
 *
 * Бот у CRM свой, отдельный от бота сайта: направления не должны пересекаться,
 * а отзыв одного токена не должен ронять второе.
 *
 * Отправка никогда не мешает основной работе: сбой канала пишется в журнал,
 * но не превращается в ошибку запроса. Сделка важнее уведомления о ней.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/model.php';

/** Куда складываются неудачные отправки, чтобы было что показать при разборе. */
function crm_notify_log(string $line): void
{
    @file_put_contents(
        CRM_DATA_DIR . '/notify.log',
        crm_now() . ' ' . $line . "\n",
        FILE_APPEND | LOCK_EX,
    );
}

/* ------------------------------------------------------------------ Telegram */

/** Токен бота CRM. Пустая строка означает «канал не настроен». */
function crm_telegram_token(): string
{
    return trim((string) (crm_settings()['telegramToken'] ?? ''));
}

/**
 * Секрет вебхука. Выводится из ключа сессий, поэтому переживает перезапуски
 * и не хранится отдельно, но при этом не угадывается снаружи.
 */
function crm_telegram_secret(): string
{
    return substr(hash_hmac('sha256', 'telegram-webhook', crm_session_key()), 0, 32);
}

/** Запрос к Bot API. Возвращает разобранный ответ или null при сбое связи. */
function crm_telegram_call(string $method, array $payload): ?array
{
    $token = crm_telegram_token();
    if ($token === '') {
        return null;
    }

    $url = 'https://api.telegram.org/bot' . $token . '/' . $method;
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);

    if (!function_exists('curl_init')) {
        crm_notify_log('telegram: на хостинге нет curl');
        return null;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if (!is_string($response)) {
        crm_notify_log('telegram ' . $method . ': ' . ($error !== '' ? $error : 'нет ответа'));
        return null;
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        crm_notify_log('telegram ' . $method . ': непонятный ответ');
        return null;
    }

    if (($data['ok'] ?? false) !== true) {
        crm_notify_log('telegram ' . $method . ': ' . (string) ($data['description'] ?? 'отказ'));
    }

    return $data;
}

/** Отправка сообщения в личку сотруднику. */
function crm_telegram_send(string $chatId, string $text): bool
{
    $result = crm_telegram_call('sendMessage', [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML',
        // Ссылки на карточки сделок не нужно раскрывать превью: они закрыты
        // авторизацией, и Telegram всё равно покажет заглушку входа.
        'link_preview_options' => ['is_disabled' => true],
    ]);

    return ($result['ok'] ?? false) === true;
}

/* ---------------------------------------------------------------- получатели */

/** Активные сотрудники, которым можно и нужно писать. */
function crm_notify_recipients(?string $exceptUserId = null): array
{
    $rows = crm_all('SELECT * FROM crm_users WHERE is_active = 1 AND notify_muted = 0');

    return array_values(array_filter(
        $rows,
        // Автору события уведомление о нём же не нужно: он только что это сделал.
        fn($row) => $exceptUserId === null || (string) $row['id'] !== $exceptUserId,
    ));
}

/**
 * Отправить уведомление конкретным сотрудникам обоими каналами.
 *
 * @param array $users строки crm_users
 */
function crm_notify(array $users, string $title, string $body, ?string $url = null): void
{
    foreach ($users as $user) {
        $chatId = (string) ($user['telegram_chat_id'] ?? '');
        if ($chatId !== '') {
            $text = '<b>' . crm_html($title) . '</b>' . "\n" . crm_html($body);
            if ($url !== null) {
                $text .= "\n\n" . $url;
            }
            crm_telegram_send($chatId, $text);
        }

        crm_push_send((string) $user['id'], $title, $body, $url);
    }
}

/** Уведомить всех, кроме автора события. */
function crm_notify_all(string $title, string $body, ?string $exceptUserId = null, ?string $url = null): void
{
    crm_notify(crm_notify_recipients($exceptUserId), $title, $body, $url);
}

/** Уведомить одного сотрудника по идентификатору. */
function crm_notify_user(string $userId, string $title, string $body, ?string $url = null): void
{
    $row = crm_one('SELECT * FROM crm_users WHERE id = ? AND is_active = 1 AND notify_muted = 0', [$userId]);
    if ($row !== null) {
        crm_notify([$row], $title, $body, $url);
    }
}

function crm_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Адрес карточки сделки для ссылки в уведомлении. */
function crm_deal_url(string $dealId): string
{
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($host === '') {
        return '';
    }
    return (crm_is_https() ? 'https://' : 'http://') . $host . '/crm/deals/' . $dealId;
}

/** Код привязки Telegram. Выдаётся сотруднику и живёт до использования. */
function crm_link_code(string $userId): string
{
    $row = crm_one('SELECT telegram_code FROM crm_users WHERE id = ?', [$userId]);
    $existing = (string) ($row['telegram_code'] ?? '');
    if ($existing !== '') {
        return $existing;
    }

    // Без похожих друг на друга символов: код диктуют вслух и набирают руками.
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 6; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }

    crm_exec('UPDATE crm_users SET telegram_code = ? WHERE id = ?', [$code, $userId]);
    return $code;
}
