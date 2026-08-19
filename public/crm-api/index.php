<?php
/**
 * Единая точка входа API CRM.
 *
 * Все адреса вида /crm/api/<что-то> Apache заворачивает сюда (см. .htaccess
 * в корне сайта). Один входной файл проще держать в порядке на общем хостинге,
 * чем десяток скриптов с повторяющейся преамбулой.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/boot.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/model.php';

/** Маршрут запроса: «deals/abc123» без ведущего и конечного слэша. */
function crm_route(): array
{
    $raw = (string) ($_GET['__route'] ?? '');
    if ($raw === '') {
        // Запасной вариант, если правило перезаписи не сработало.
        $raw = (string) ($_SERVER['PATH_INFO'] ?? '');
    }
    $raw = trim($raw, '/');
    if ($raw === '') {
        return [];
    }
    return array_values(array_filter(explode('/', $raw), fn($p) => $p !== ''));
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$path = crm_route();
$section = $path[0] ?? '';

// Браузер не должен кэшировать ответы CRM ни при каких условиях.
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex, nofollow');

try {
    switch ($section) {
        case 'auth':
            require __DIR__ . '/routes/auth.php';
            crm_route_auth($method, array_slice($path, 1));
            break;

        case 'users':
            require __DIR__ . '/routes/users.php';
            crm_route_users($method, array_slice($path, 1));
            break;

        case 'deals':
            require __DIR__ . '/routes/deals.php';
            crm_route_deals($method, array_slice($path, 1));
            break;

        case 'tasks':
            require __DIR__ . '/routes/tasks.php';
            crm_route_tasks($method, array_slice($path, 1));
            break;

        case 'files':
            require __DIR__ . '/routes/files.php';
            crm_route_files($method, array_slice($path, 1));
            break;

        case 'settings':
            require __DIR__ . '/routes/settings.php';
            crm_route_settings($method, array_slice($path, 1));
            break;

        case 'dashboard':
            require __DIR__ . '/routes/dashboard.php';
            crm_route_dashboard($method, array_slice($path, 1));
            break;

        case 'track':
            require __DIR__ . '/routes/track.php';
            crm_route_track($method, array_slice($path, 1));
            break;

        case 'notify':
            require __DIR__ . '/routes/notify.php';
            crm_route_notify($method, array_slice($path, 1));
            break;

        // Вебхук бота уведомлений. Проверяет себя сам секретом от Telegram.
        case 'telegram':
            require __DIR__ . '/routes/telegram.php';
            crm_route_telegram($method, array_slice($path, 1));
            break;

        case 'rate':
            require __DIR__ . '/routes/rate.php';
            crm_route_rate($method, array_slice($path, 1));
            break;

        case 'ping':
            crm_json(['ok' => true, 'service' => 'crm', 'hasUsers' => crm_has_users()]);

        default:
            crm_fail(404, 'not_found', 'Неизвестный метод API');
    }
} catch (PDOException $e) {
    // Текст исключения может содержать фрагменты запроса — наружу не отдаём.
    crm_fail(500, 'db_error', 'Ошибка базы данных');
} catch (Throwable $e) {
    crm_fail(500, 'server_error', 'Внутренняя ошибка сервера');
}
