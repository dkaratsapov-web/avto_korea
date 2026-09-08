<?php
/**
 * Отзывы сайта — просмотр и удаление из CRM.
 *
 * Сами отзывы живут не здесь. Их публикует бот: владелец пересылает ему видео
 * с выдачи, бот кладёт запись в своё хранилище, и оттуда её забирают сайт и
 * мини-апп. CRM — только пульт: показать список и удалить лишнее.
 *
 * Почему пульт вообще понадобился. Удалять отзывы можно и в админке бота, но
 * она открывается только с телефона, внутри Telegram, и попасть туда можно
 * лишь через кнопку мини-аппа — которая уже однажды ломалась. Работа с
 * витриной не должна зависеть от того, работает ли сегодня кнопка в мессенджере.
 *
 * Представляется CRM отдельным ключом: подписи мини-аппа у неё нет и быть не
 * может. Ключ владелец берёт в боте командой /crm и вставляет здесь один раз.
 * Прав у ключа ровно на отзывы — ни каталога, ни заявок, ни рассылки.
 */

declare(strict_types=1);

/**
 * Адрес воркера с ботом.
 *
 * Тот же, что в public/api/proxy.php. Держать его тут копией, а не тянуть
 * общий файл, — сознательно: proxy.php при подключении начинает обслуживать
 * запрос, а не объявлять константы.
 */
const CRM_BOT_ORIGIN = 'https://diauto-bot.d-karatsapov.workers.dev';

/** Ключ доступа к отзывам бота. Пустая строка — «не подключено». */
function crm_reviews_key(): string
{
    return trim((string) (crm_settings()['botReviewsKey'] ?? ''));
}

/**
 * Запрос к боту.
 *
 * Возвращает разобранный ответ. Сбой связи и любой невнятный ответ —
 * это отказ с человеческим текстом: менеджеру не за что винить себя,
 * когда лежит чужой сервер.
 */
function crm_reviews_call(string $key, string $action, array $payload = []): array
{
    if (!function_exists('curl_init')) {
        crm_fail(500, 'no_curl', 'На хостинге нет curl — запрос к боту невозможен');
    }

    $ch = curl_init(CRM_BOT_ORIGIN . '/api/crm');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(
            ['action' => $action, 'payload' => $payload],
            JSON_UNESCAPED_UNICODE,
        ),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Crm-Key: ' . $key],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 6,
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

    if (($data['ok'] ?? false) !== true) {
        $error = (string) ($data['error'] ?? 'bot_error');
        crm_fail(
            $status === 401 ? 422 : 502,
            $error,
            match ($error) {
                'not_paired' => 'Бот ещё не выдал ключ. Отправьте ему команду /crm',
                'bad_key' => 'Бот не принял ключ. Возьмите новый командой /crm',
                default => 'Бот отказал в запросе (' . $error . ')',
            },
        );
    }

    return $data;
}

/**
 * Адреса файлов — на свой домен.
 *
 * Бот отдаёт ссылки на себя, а его домен (*.workers.dev) у российских
 * провайдеров закрыт: в браузере менеджера превью просто не загрузятся.
 * Сайт умеет отдавать те же файлы со своего адреса (public/api/proxy.php),
 * поэтому переписываем ссылки на него.
 */
function crm_reviews_localize(array $reviews): array
{
    $fix = static function ($url) {
        if (!is_string($url)) {
            return $url;
        }
        return str_replace(CRM_BOT_ORIGIN . '/api/', '/api/', $url);
    };

    return array_map(static function ($review) use ($fix) {
        if (!is_array($review)) {
            return $review;
        }
        foreach (['media', 'video', 'poster'] as $field) {
            if (isset($review[$field])) {
                $review[$field] = $fix($review[$field]);
            }
        }
        foreach (['images', 'videos'] as $field) {
            if (isset($review[$field]) && is_array($review[$field])) {
                $review[$field] = array_map($fix, $review[$field]);
            }
        }
        return $review;
    }, $reviews);
}

/** Список отзывов для интерфейса. */
function crm_reviews_list(string $key): array
{
    $data = crm_reviews_call($key, 'reviews.list');
    $reviews = $data['reviews'] ?? [];
    return crm_reviews_localize(is_array($reviews) ? $reviews : []);
}

function crm_route_reviews(string $method, array $path): void
{
    $action = $path[0] ?? '';

    // --- список ---
    if ($action === '' && $method === 'GET') {
        crm_require_user();
        $key = crm_reviews_key();
        if ($key === '') {
            // Не ошибка: раздел просто ещё не подключён, и интерфейс покажет
            // инструкцию вместо пустого списка.
            crm_json(['ok' => true, 'connected' => false, 'reviews' => []]);
        }
        crm_json(['ok' => true, 'connected' => true, 'reviews' => crm_reviews_list($key)]);
    }

    // --- подключение ключом из бота ---
    if ($action === 'key' && $method === 'POST') {
        crm_require_owner();
        $key = crm_str(crm_body(), 'key', 190);
        if ($key === '') {
            // Пустое значение — осознанное отключение раздела.
            crm_save_settings(['botReviewsKey' => '']);
            crm_json(['ok' => true, 'connected' => false, 'reviews' => []]);
        }

        // Ключ проверяем ДО сохранения: иначе владелец увидел бы «сохранено»
        // и пустой список, и гадал, кончились отзывы или не тот ключ.
        $reviews = crm_reviews_list($key);
        crm_save_settings(['botReviewsKey' => $key]);
        crm_json(['ok' => true, 'connected' => true, 'reviews' => $reviews]);
    }

    // --- правка текста отзыва ---
    if ($action !== '' && $action !== 'key' && $method === 'POST') {
        crm_require_owner();
        $key = crm_reviews_key();
        if ($key === '') {
            crm_fail(409, 'not_connected', 'Раздел не подключён к боту');
        }

        /*
         * Отправляем весь набор полей, а не одно изменённое.
         *
         * Бот собирает запись заново из того, что пришло: отправишь только
         * текст — сотрёшь имя и оценку. Поэтому интерфейс присылает карточку
         * целиком, а мы её просто передаём.
         */
        $body = crm_body();
        $data = crm_reviews_call($key, 'reviews.save', [
            'id' => $action,
            'name' => crm_str($body, 'name', 80),
            'text' => crm_str($body, 'text', 1000),
            'car' => crm_str($body, 'car', 120),
            'rating' => max(1, min(5, (int) ($body['rating'] ?? 5))),
        ]);
        $reviews = $data['reviews'] ?? [];
        crm_json([
            'ok' => true,
            'connected' => true,
            'reviews' => crm_reviews_localize(is_array($reviews) ? $reviews : []),
        ]);
    }

    // --- удалить все ---
    if ($action === '' && $method === 'DELETE') {
        crm_require_owner();
        $key = crm_reviews_key();
        if ($key === '') {
            crm_fail(409, 'not_connected', 'Раздел не подключён к боту');
        }
        crm_reviews_call($key, 'reviews.clear');
        crm_json(['ok' => true, 'connected' => true, 'reviews' => []]);
    }

    // --- удалить один ---
    if ($action !== '' && $action !== 'key' && $method === 'DELETE') {
        crm_require_owner();
        $key = crm_reviews_key();
        if ($key === '') {
            crm_fail(409, 'not_connected', 'Раздел не подключён к боту');
        }
        $data = crm_reviews_call($key, 'reviews.remove', ['id' => $action]);
        $reviews = $data['reviews'] ?? [];
        crm_json([
            'ok' => true,
            'connected' => true,
            'reviews' => crm_reviews_localize(is_array($reviews) ? $reviews : []),
        ]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела отзывов');
}
