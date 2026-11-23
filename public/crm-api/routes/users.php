<?php
/**
 * Сотрудники CRM.
 *
 * Список видят все — он нужен, чтобы назначать ответственного и исполнителя
 * задачи. Заводить, отключать и менять пароли может только владелец.
 */

declare(strict_types=1);

function crm_route_users(string $method, array $path): void
{
    $id = $path[0] ?? '';

    if ($id === '' && $method === 'GET') {
        crm_require_user();
        $rows = crm_all('SELECT * FROM crm_users ORDER BY role DESC, name');
        crm_json(['ok' => true, 'users' => array_map('crm_public_user', $rows)]);
    }

    if ($id === '' && $method === 'POST') {
        crm_require_owner();
        $body = crm_body();

        $email = mb_strtolower(crm_str($body, 'email', 190));
        $name = crm_str($body, 'name', 190);
        $password = (string) ($body['password'] ?? '');
        $role = crm_enum($body, 'role', CRM_ROLES, 'MANAGER');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            crm_fail(422, 'bad_email', 'Укажите корректный адрес почты');
        }
        if ($name === '') {
            crm_fail(422, 'bad_name', 'Укажите имя сотрудника');
        }
        if (mb_strlen($password) < 8) {
            crm_fail(422, 'weak_password', 'Пароль должен быть не короче 8 символов');
        }
        if (crm_one('SELECT id FROM crm_users WHERE email = ?', [$email]) !== null) {
            crm_fail(409, 'email_taken', 'Сотрудник с такой почтой уже заведён');
        }

        $newId = crm_id();
        $now = crm_now();
        crm_exec(
            'INSERT INTO crm_users (id, email, name, password_hash, role, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            [$newId, $email, $name, crm_hash_password($password), $role, $now, $now],
        );

        $created = crm_one('SELECT * FROM crm_users WHERE id = ?', [$newId]);
        crm_json(['ok' => true, 'user' => crm_public_user($created ?? [])]);
    }

    if ($id !== '' && $method === 'PATCH') {
        $owner = crm_require_owner();
        $body = crm_body();

        $target = crm_one('SELECT * FROM crm_users WHERE id = ?', [$id]);
        if ($target === null) {
            crm_fail(404, 'not_found', 'Сотрудник не найден');
        }

        $fields = [];
        $params = [];

        if (array_key_exists('name', $body)) {
            $name = crm_str($body, 'name', 190);
            if ($name === '') {
                crm_fail(422, 'bad_name', 'Имя не может быть пустым');
            }
            $fields[] = 'name = ?';
            $params[] = $name;
        }

        if (array_key_exists('role', $body)) {
            $role = crm_enum($body, 'role', CRM_ROLES);
            // Владелец не должен разжаловать сам себя: иначе в CRM не останется
            // никого, кто может заводить сотрудников.
            if ($target['id'] === $owner['id'] && $role !== 'OWNER') {
                crm_fail(422, 'last_owner', 'Нельзя снять с себя права владельца');
            }
            $fields[] = 'role = ?';
            $params[] = $role;
        }

        if (array_key_exists('isActive', $body)) {
            $active = crm_bool($body, 'isActive');
            if ($target['id'] === $owner['id'] && !$active) {
                crm_fail(422, 'self_disable', 'Нельзя отключить самого себя');
            }
            $fields[] = 'is_active = ?';
            $params[] = $active ? 1 : 0;

            if (!$active) {
                // Отключение должно действовать сразу, а не после выхода.
                crm_exec('DELETE FROM crm_sessions WHERE user_id = ?', [$id]);
            }
        }

        if (array_key_exists('password', $body)) {
            $password = (string) $body['password'];
            if (mb_strlen($password) < 8) {
                crm_fail(422, 'weak_password', 'Пароль должен быть не короче 8 символов');
            }
            $fields[] = 'password_hash = ?';
            $params[] = crm_hash_password($password);
            crm_exec('DELETE FROM crm_sessions WHERE user_id = ?', [$id]);
        }

        if ($fields === []) {
            crm_fail(422, 'nothing_to_update', 'Нет полей для изменения');
        }

        $fields[] = 'updated_at = ?';
        $params[] = crm_now();
        $params[] = $id;

        crm_exec('UPDATE crm_users SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);

        $updated = crm_one('SELECT * FROM crm_users WHERE id = ?', [$id]);
        crm_json(['ok' => true, 'user' => crm_public_user($updated ?? [])]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела сотрудников');
}
