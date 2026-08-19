<?php
/**
 * Настройка уведомлений: подключение бота, привязка сотрудника, подписка
 * браузера на push.
 *
 * Токен бота наружу не отдаётся никогда — ни владельцу, ни в отладке. Клиент
 * узнаёт только, настроен канал или нет: показать токен на экране значит
 * однажды показать его на скриншоте.
 */

declare(strict_types=1);

require_once __DIR__ . '/../lib/notify.php';
require_once __DIR__ . '/../lib/push.php';

function crm_route_notify(string $method, array $path): void
{
    $action = $path[0] ?? '';

    // --- состояние каналов для интерфейса ---
    if ($action === '' && $method === 'GET') {
        $user = crm_require_user();

        crm_json([
            'ok' => true,
            'telegramConfigured' => crm_telegram_token() !== '',
            'telegramLinked' => (string) ($user['telegram_chat_id'] ?? '') !== '',
            'muted' => (bool) ($user['notify_muted'] ?? false),
            'linkCode' => (string) ($user['telegram_chat_id'] ?? '') !== ''
                ? null
                : crm_link_code((string) $user['id']),
            'botUsername' => (string) (crm_settings()['telegramBot'] ?? ''),
            'vapidPublicKey' => crm_vapid_public(),
            'pushDevices' => (int) (crm_one(
                'SELECT COUNT(*) AS n FROM crm_push WHERE user_id = ?',
                [$user['id']],
            )['n'] ?? 0),
        ]);
    }

    // --- владелец сохраняет токен бота ---
    if ($action === 'telegram' && $method === 'POST') {
        crm_require_owner();
        $body = crm_body();

        $token = crm_str($body, 'token', 190);
        // Пустое значение — осознанное отключение канала.
        if ($token !== '' && !preg_match('/^\d+:[A-Za-z0-9_-]{20,}$/', $token)) {
            crm_fail(422, 'bad_token', 'Похоже, это не токен бота. Он выглядит как 1234567890:AA...');
        }

        crm_save_settings([
            'telegramToken' => $token,
            'telegramBot' => ltrim(crm_str($body, 'botUsername', 64), '@'),
        ]);

        crm_json(['ok' => true, 'telegramConfigured' => $token !== '']);
    }

    // --- владелец подключает вебхук и проверяет связь ---
    if ($action === 'telegram-check' && $method === 'POST') {
        crm_require_owner();

        if (crm_telegram_token() === '') {
            crm_fail(422, 'no_token', 'Сначала сохраните токен бота');
        }

        $me = crm_telegram_call('getMe', []);
        if ($me === null) {
            crm_fail(
                502,
                'telegram_unreachable',
                'Сервер не смог связаться с Telegram. Проверьте, что хостинг выпускает наружу запросы к api.telegram.org',
            );
        }
        if (($me['ok'] ?? false) !== true) {
            crm_fail(422, 'bad_token', 'Telegram не принял токен: ' . (string) ($me['description'] ?? ''));
        }

        $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
        $webhook = (crm_is_https() ? 'https://' : 'http://') . $host . '/crm/api/telegram';

        $set = crm_telegram_call('setWebhook', [
            'url' => $webhook,
            'secret_token' => crm_telegram_secret(),
            // Ничего, кроме личных сообщений, боту CRM не нужно.
            'allowed_updates' => ['message'],
            'drop_pending_updates' => true,
        ]);

        crm_json([
            'ok' => true,
            'bot' => (string) ($me['result']['username'] ?? ''),
            'webhook' => ($set['ok'] ?? false) === true,
            'webhookUrl' => $webhook,
        ]);
    }

    // --- сотрудник отвязывает Telegram или глушит уведомления ---
    if ($action === 'unlink' && $method === 'POST') {
        $user = crm_require_user();
        crm_exec(
            'UPDATE crm_users SET telegram_chat_id = NULL, telegram_code = NULL WHERE id = ?',
            [$user['id']],
        );
        crm_json(['ok' => true]);
    }

    if ($action === 'mute' && $method === 'POST') {
        $user = crm_require_user();
        $muted = crm_bool(crm_body(), 'muted');
        crm_exec('UPDATE crm_users SET notify_muted = ? WHERE id = ?', [$muted ? 1 : 0, $user['id']]);
        crm_json(['ok' => true, 'muted' => $muted]);
    }

    // --- проверка: прислать себе тестовое уведомление ---
    if ($action === 'test' && $method === 'POST') {
        $user = crm_require_user();

        $sent = [];
        $chatId = (string) ($user['telegram_chat_id'] ?? '');
        if ($chatId !== '' && crm_telegram_send($chatId, "<b>Проверка связи</b>\nУведомления CRM работают.")) {
            $sent[] = 'telegram';
        }

        $devices = (int) (crm_one('SELECT COUNT(*) AS n FROM crm_push WHERE user_id = ?', [$user['id']])['n'] ?? 0);
        if ($devices > 0) {
            crm_push_send((string) $user['id'], 'Проверка связи', 'Уведомления CRM работают.');
            $sent[] = 'push';
        }

        if ($sent === []) {
            crm_fail(422, 'no_channels', 'Ни один канал не подключён: привяжите Telegram или разрешите уведомления в браузере');
        }

        crm_json(['ok' => true, 'sent' => $sent]);
    }

    // --- подписка браузера на push ---
    if ($action === 'push' && $method === 'POST') {
        $user = crm_require_user();
        $body = crm_body();

        $endpoint = crm_str($body, 'endpoint', 500);
        $p256dh = crm_str($body, 'p256dh', 190);
        $auth = crm_str($body, 'auth', 64);

        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            crm_fail(422, 'bad_subscription', 'Подписка неполная');
        }

        // Адрес подписки уникален: повторная подписка того же браузера должна
        // обновлять запись, а не плодить дубли, иначе одно событие придёт трижды.
        $existing = crm_one('SELECT id FROM crm_push WHERE endpoint = ?', [$endpoint]);
        if ($existing !== null) {
            crm_exec(
                'UPDATE crm_push SET user_id = ?, p256dh = ?, auth = ?, failed_at = NULL WHERE id = ?',
                [$user['id'], $p256dh, $auth, $existing['id']],
            );
        } else {
            crm_exec(
                'INSERT INTO crm_push (id, user_id, endpoint, p256dh, auth, label, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    crm_id(),
                    $user['id'],
                    $endpoint,
                    $p256dh,
                    $auth,
                    mb_substr(crm_str($body, 'label', 120), 0, 120),
                    crm_now(),
                ],
            );
        }

        crm_json(['ok' => true]);
    }

    if ($action === 'push' && $method === 'DELETE') {
        $user = crm_require_user();
        $endpoint = crm_str(crm_body(), 'endpoint', 500);

        if ($endpoint !== '') {
            crm_exec('DELETE FROM crm_push WHERE endpoint = ? AND user_id = ?', [$endpoint, $user['id']]);
        } else {
            crm_exec('DELETE FROM crm_push WHERE user_id = ?', [$user['id']]);
        }

        crm_json(['ok' => true]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела уведомлений');
}
