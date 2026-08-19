<?php
/**
 * Доступы CRM.
 *
 * Пользователи CRM не имеют ничего общего ни с админкой сайта, ни со списком
 * админов бота: это отдельная таблица, отдельные пароли и отдельная кука.
 * Кука ограничена путём /crm — на остальной сайт она не отправляется вовсе.
 *
 * Сессия хранится в базе, а в куке лежит только её идентификатор с подписью.
 * Поэтому доступ можно отозвать мгновенно: достаточно удалить строку сессии,
 * не дожидаясь, пока истечёт срок токена.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

const CRM_ROLES = ['OWNER', 'MANAGER'];

/** Хэш пароля. Стоимость подобрана под общий хостинг: заметно, но терпимо. */
function crm_hash_password(string $password): string
{
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);
}

function crm_check_password(string $password, string $hash): bool
{
    return password_verify($password, $hash);
}

/** Значение куки: идентификатор сессии и подпись, чтобы не перебирали чужие. */
function crm_sign_session(string $sessionId): string
{
    return $sessionId . '.' . hash_hmac('sha256', $sessionId, crm_session_key());
}

function crm_verify_cookie(string $cookie): ?string
{
    $parts = explode('.', $cookie, 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$sessionId, $signature] = $parts;
    $expected = hash_hmac('sha256', $sessionId, crm_session_key());

    return hash_equals($expected, $signature) ? $sessionId : null;
}

function crm_start_session(string $userId): string
{
    $sessionId = crm_id() . bin2hex(random_bytes(8));
    $now = crm_now();

    crm_exec(
        'INSERT INTO crm_sessions (id, user_id, created_at, seen_at, user_agent) VALUES (?, ?, ?, ?, ?)',
        [
            $sessionId,
            $userId,
            $now,
            $now,
            mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
        ],
    );

    setcookie(CRM_COOKIE, crm_sign_session($sessionId), [
        'expires' => time() + CRM_SESSION_TTL,
        // Кука не уходит на страницы сайта и не попадает в логи чужих запросов.
        'path' => '/crm',
        'secure' => crm_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    return $sessionId;
}

function crm_end_session(): void
{
    $cookie = (string) ($_COOKIE[CRM_COOKIE] ?? '');
    $sessionId = $cookie === '' ? null : crm_verify_cookie($cookie);

    if ($sessionId !== null) {
        crm_exec('DELETE FROM crm_sessions WHERE id = ?', [$sessionId]);
    }

    setcookie(CRM_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/crm',
        'secure' => crm_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/**
 * На хостинге сайт стоит за прокси, поэтому одного $_SERVER['HTTPS'] мало:
 * без проверки заголовка кука получила бы флаг Secure и терялась.
 */
function crm_is_https(): bool
{
    if (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? 'off') !== 'off') {
        return true;
    }
    return ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

/** Текущий пользователь или null. Заодно продлевает и чистит сессию. */
function crm_current_user(): ?array
{
    static $user = null;
    static $resolved = false;
    if ($resolved) {
        return $user;
    }
    $resolved = true;

    $cookie = (string) ($_COOKIE[CRM_COOKIE] ?? '');
    if ($cookie === '') {
        return null;
    }

    $sessionId = crm_verify_cookie($cookie);
    if ($sessionId === null) {
        return null;
    }

    $session = crm_one('SELECT * FROM crm_sessions WHERE id = ?', [$sessionId]);
    if ($session === null) {
        return null;
    }

    // Протухшую сессию удаляем сразу, чтобы таблица не росла бесконечно.
    if (strtotime((string) $session['seen_at']) < time() - CRM_SESSION_TTL) {
        crm_exec('DELETE FROM crm_sessions WHERE id = ?', [$sessionId]);
        return null;
    }

    $found = crm_one('SELECT * FROM crm_users WHERE id = ? AND is_active = 1', [$session['user_id']]);
    if ($found === null) {
        // Пользователя отключили — сессия должна умереть вместе с доступом.
        crm_exec('DELETE FROM crm_sessions WHERE user_id = ?', [$session['user_id']]);
        return null;
    }

    // Отметку «был здесь» обновляем не чаще раза в час: иначе каждый запрос
    // интерфейса превращался бы в запись в базу.
    if (strtotime((string) $session['seen_at']) < time() - 3600) {
        crm_exec('UPDATE crm_sessions SET seen_at = ? WHERE id = ?', [crm_now(), $sessionId]);
    }

    return $user = $found;
}

/** Требует вход. Возвращает пользователя. */
function crm_require_user(): array
{
    $user = crm_current_user();
    if ($user === null) {
        crm_fail(401, 'unauthorized', 'Нужно войти в CRM');
    }
    return $user;
}

/** Требует роль владельца. */
function crm_require_owner(): array
{
    $user = crm_require_user();
    if (($user['role'] ?? '') !== 'OWNER') {
        crm_fail(403, 'forbidden', 'Раздел доступен только владельцу');
    }
    return $user;
}

/** Пользователь для отдачи наружу — без хэша пароля. */
function crm_public_user(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'role' => $row['role'],
        'isActive' => (bool) $row['is_active'],
        'createdAt' => $row['created_at'],
    ];
}

/**
 * Ограничение на подбор пароля: пять неудач с одного адреса за четверть часа.
 * Счётчик лежит во временном каталоге — терять его при перезапуске не страшно.
 */
function crm_login_throttle(): void
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return;
    }

    $file = sys_get_temp_dir() . '/crm-login-' . md5($ip);
    $hits = @json_decode((string) @file_get_contents($file), true);
    $hits = is_array($hits) ? array_values(array_filter($hits, fn($t) => $t > time() - 900)) : [];

    if (count($hits) >= 5) {
        crm_fail(429, 'too_many_attempts', 'Слишком много попыток входа. Попробуйте через 15 минут');
    }

    $hits[] = time();
    @file_put_contents($file, json_encode($hits), LOCK_EX);
}

/** Сбрасывает счётчик после удачного входа. */
function crm_login_throttle_reset(): void
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip !== '') {
        @unlink(sys_get_temp_dir() . '/crm-login-' . md5($ip));
    }
}

/** Есть ли в системе хоть один пользователь. От этого зависит первый запуск. */
function crm_has_users(): bool
{
    $row = crm_one('SELECT COUNT(*) AS n FROM crm_users');
    return (int) ($row['n'] ?? 0) > 0;
}
