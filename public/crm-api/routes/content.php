<?php
/**
 * Раздел «Контент» — контент-план Instagram.
 *
 * План — один список публикаций: дата, рубрика, формат, тема, зацепка,
 * визуал, примечание, статус. Хранится одной записью в crm_settings
 * (id = content_plan): таблица и так «ключ → JSON», миграция не нужна, а в
 * резервные копии запись попадает вместе с остальными настройками.
 *
 * Пока в базе ничего нет, отдаём null — интерфейс показывает стартовый
 * план, собранный из context/content-calendar.md, и сохраняет его целиком
 * при первой правке.
 */

declare(strict_types=1);

const CRM_CONTENT_KEY = 'content_plan';
const CRM_CONTENT_STATUSES = ['idea', 'progress', 'ready', 'published'];

function crm_content_load(): ?array
{
    $row = crm_one('SELECT data, updated_at FROM crm_settings WHERE id = ?', [CRM_CONTENT_KEY]);
    if ($row === null) {
        return null;
    }
    $data = json_decode((string) $row['data'], true);
    if (!is_array($data) || !isset($data['posts']) || !is_array($data['posts'])) {
        return null;
    }
    return ['posts' => $data['posts'], 'updatedAt' => $row['updated_at'], 'updatedBy' => $data['updatedBy'] ?? ''];
}

/** Публикация из запроса: только известные поля, с обрезкой длины. */
function crm_content_clean(array $p, int $i): array
{
    $date = crm_str($p, 'date', 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        crm_fail(422, 'bad_date', 'Публикация №' . ($i + 1) . ': дата должна быть в формате ГГГГ-ММ-ДД');
    }
    $status = crm_str($p, 'status', 16);
    if (!in_array($status, CRM_CONTENT_STATUSES, true)) {
        $status = 'idea';
    }
    $id = crm_str($p, 'id', 40);
    if ($id === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
        $id = 'p' . bin2hex(random_bytes(4));
    }
    return [
        'id' => $id,
        'n' => max(0, (int) ($p['n'] ?? 0)),
        'date' => $date,
        'rubric' => crm_str($p, 'rubric', 60),
        'format' => crm_str($p, 'format', 40),
        'goal' => crm_str($p, 'goal', 80),
        'topic' => crm_str($p, 'topic', 400),
        'hook' => crm_str($p, 'hook', 400),
        'visual' => crm_str($p, 'visual', 800),
        'note' => crm_str($p, 'note', 800),
        'status' => $status,
    ];
}

function crm_route_content(string $method, array $path): void
{
    $user = crm_require_user();

    if (($path[0] ?? '') === '' && $method === 'GET') {
        crm_json(['ok' => true, 'plan' => crm_content_load()]);
    }

    // Сохранение плана целиком: список небольшой, а правят его один-два
    // человека — проще и надёжнее, чем склеивать частичные правки.
    if (($path[0] ?? '') === '' && $method === 'POST') {
        $body = crm_body();
        $posts = $body['posts'] ?? null;
        if (!is_array($posts) || count($posts) > 300) {
            crm_fail(422, 'bad_posts', 'Нужен список публикаций (не больше 300)');
        }
        $clean = [];
        foreach (array_values($posts) as $i => $p) {
            if (!is_array($p)) {
                crm_fail(422, 'bad_post', 'Публикация №' . ($i + 1) . ' — не объект');
            }
            $clean[] = crm_content_clean($p, $i);
        }
        usort($clean, fn($a, $b) => strcmp($a['date'], $b['date']) ?: ($a['n'] <=> $b['n']));

        $payload = json_encode(
            ['posts' => $clean, 'updatedBy' => (string) ($user['name'] ?? '')],
            JSON_UNESCAPED_UNICODE,
        );
        $exists = crm_one('SELECT id FROM crm_settings WHERE id = ?', [CRM_CONTENT_KEY]);
        if ($exists === null) {
            crm_exec('INSERT INTO crm_settings (id, data, updated_at) VALUES (?, ?, ?)', [CRM_CONTENT_KEY, $payload, crm_now()]);
        } else {
            crm_exec('UPDATE crm_settings SET data = ?, updated_at = ? WHERE id = ?', [$payload, crm_now(), CRM_CONTENT_KEY]);
        }
        crm_json(['ok' => true, 'plan' => crm_content_load()]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела «Контент»');
}
