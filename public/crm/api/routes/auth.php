<?php
/**
 * Вход, выход и первичная настройка.
 *
 * Первый запуск: пока в базе нет ни одного пользователя, доступен один-
 * единственный метод setup — он заводит владельца. Как только владелец создан,
 * метод перестаёт отвечать навсегда, и новые сотрудники добавляются только
 * изнутри, из раздела «Сотрудники».
 */

declare(strict_types=1);

function crm_route_auth(string $method, array $path): void
{
    $action = $path[0] ?? '';

    if ($action === 'me' && $method === 'GET') {
        $user = crm_current_user();
        crm_json([
            'ok' => true,
            'user' => $user === null ? null : crm_public_user($user),
            // Интерфейс по этому флагу решает, показывать вход или первичную настройку.
            'needsSetup' => !crm_has_users(),
        ]);
    }

    if ($action === 'login' && $method === 'POST') {
        crm_login_throttle();

        $body = crm_body();
        $email = mb_strtolower(crm_str($body, 'email', 190));
        $password = (string) ($body['password'] ?? '');

        $user = crm_one('SELECT * FROM crm_users WHERE email = ?', [$email]);

        // Один и тот же ответ на неизвестную почту и на неверный пароль:
        // иначе по коду ошибки можно перебрать список сотрудников.
        if ($user === null || !crm_check_password($password, (string) $user['password_hash'])) {
            crm_fail(401, 'bad_credentials', 'Неверная почта или пароль');
        }
        if (!(bool) $user['is_active']) {
            crm_fail(403, 'user_disabled', 'Доступ отключён владельцем');
        }

        crm_login_throttle_reset();
        crm_start_session((string) $user['id']);

        crm_json(['ok' => true, 'user' => crm_public_user($user)]);
    }

    if ($action === 'logout' && $method === 'POST') {
        crm_end_session();
        crm_json(['ok' => true]);
    }

    if ($action === 'password' && $method === 'POST') {
        $user = crm_require_user();
        $body = crm_body();

        $current = (string) ($body['current'] ?? '');
        $next = (string) ($body['next'] ?? '');

        if (!crm_check_password($current, (string) $user['password_hash'])) {
            crm_fail(422, 'bad_password', 'Текущий пароль указан неверно');
        }
        if (mb_strlen($next) < 8) {
            crm_fail(422, 'weak_password', 'Новый пароль должен быть не короче 8 символов');
        }

        crm_exec(
            'UPDATE crm_users SET password_hash = ?, updated_at = ? WHERE id = ?',
            [crm_hash_password($next), crm_now(), $user['id']],
        );

        // Смена пароля выкидывает все остальные устройства.
        crm_exec('DELETE FROM crm_sessions WHERE user_id = ?', [$user['id']]);
        crm_start_session((string) $user['id']);

        crm_json(['ok' => true]);
    }

    if ($action === 'setup' && $method === 'POST') {
        if (crm_has_users()) {
            crm_fail(409, 'already_configured', 'CRM уже настроена — войдите под своей учётной записью');
        }

        $body = crm_body();
        $email = mb_strtolower(crm_str($body, 'email', 190));
        $name = crm_str($body, 'name', 190);
        $password = (string) ($body['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            crm_fail(422, 'bad_email', 'Укажите корректный адрес почты');
        }
        if ($name === '') {
            crm_fail(422, 'bad_name', 'Укажите имя');
        }
        if (mb_strlen($password) < 8) {
            crm_fail(422, 'weak_password', 'Пароль должен быть не короче 8 символов');
        }

        $id = crm_id();
        $now = crm_now();

        crm_exec(
            'INSERT INTO crm_users (id, email, name, password_hash, role, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            [$id, $email, $name, crm_hash_password($password), 'OWNER', $now, $now],
        );

        crm_start_session($id);

        $created = crm_one('SELECT * FROM crm_users WHERE id = ?', [$id]);
        crm_json(['ok' => true, 'user' => crm_public_user($created ?? [])]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод авторизации');
}
