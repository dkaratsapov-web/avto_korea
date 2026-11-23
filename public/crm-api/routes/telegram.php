<?php
/**
 * Вебхук бота CRM.
 *
 * Бот делает ровно одно: привязывает сотрудника к его чату по коду из профиля.
 * Никаких команд управления сделками у него нет намеренно — доступ к деньгам
 * компании не должен зависеть от того, кто держит в руках телефон с открытым
 * Telegram.
 *
 * Единственный метод CRM, доступный без входа. Защита — секрет, который
 * Telegram присылает заголовком: его знают только Telegram и этот сервер.
 */

declare(strict_types=1);

require_once __DIR__ . '/../lib/notify.php';

function crm_route_telegram(string $method, array $path): void
{
    if ($method !== 'POST') {
        crm_fail(404, 'not_found', 'Неизвестный метод');
    }

    $secret = (string) ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
    if (crm_telegram_token() === '' || !hash_equals(crm_telegram_secret(), $secret)) {
        // Не объясняем, что именно не так: это чужой запрос.
        crm_fail(403, 'forbidden', 'Отказано');
    }

    $update = crm_body();
    $message = $update['message'] ?? null;
    if (!is_array($message)) {
        crm_json(['ok' => true]);
    }

    $chatId = (string) ($message['chat']['id'] ?? '');
    $text = trim((string) ($message['text'] ?? ''));
    if ($chatId === '') {
        crm_json(['ok' => true]);
    }

    // Уже привязанному сотруднику отвечаем коротко и по делу.
    $linked = crm_one('SELECT * FROM crm_users WHERE telegram_chat_id = ?', [$chatId]);

    if ($text === '/start' || $text === '/help') {
        crm_telegram_send(
            $chatId,
            $linked !== null
                ? "Уведомления CRM подключены.\nЕсли перестанут приходить — отвяжите и привяжите заново в профиле."
                : "Это бот уведомлений CRM ДиАвто69.\n\nОткройте профиль в CRM, скопируйте код привязки и отправьте его сюда сообщением вида:\n<code>/link КОД</code>",
        );
        crm_json(['ok' => true]);
    }

    // Код принимаем и командой, и просто сообщением: диктовать «слэш линк»
    // по телефону неудобно, а набрать шесть символов — легко.
    if (preg_match('/^(?:\/link\s+)?([A-Z0-9]{6})$/i', $text, $matches)) {
        $code = strtoupper($matches[1]);
        $user = crm_one('SELECT * FROM crm_users WHERE telegram_code = ? AND is_active = 1', [$code]);

        if ($user === null) {
            crm_telegram_send($chatId, 'Код не подошёл. Откройте профиль в CRM и возьмите свежий.');
            crm_json(['ok' => true]);
        }

        // Код одноразовый: после привязки он больше ничего не открывает.
        crm_exec(
            'UPDATE crm_users SET telegram_chat_id = ?, telegram_code = NULL WHERE id = ?',
            [$chatId, $user['id']],
        );
        // Чужую привязку к тому же чату снимаем: один чат — один сотрудник.
        crm_exec(
            'UPDATE crm_users SET telegram_chat_id = NULL WHERE telegram_chat_id = ? AND id <> ?',
            [$chatId, $user['id']],
        );

        crm_telegram_send(
            $chatId,
            'Готово, ' . crm_html((string) $user['name']) . ". Уведомления CRM будут приходить сюда.",
        );
        crm_json(['ok' => true]);
    }

    if ($linked === null) {
        crm_telegram_send($chatId, "Отправьте код привязки из профиля CRM — шесть символов.");
    }

    crm_json(['ok' => true]);
}
