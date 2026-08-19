<?php
/**
 * Задачи по сделкам.
 *
 * Задача всегда привязана к сделке — отдельного списка «просто дел» нет
 * намеренно: в работе по импорту любое дело относится к конкретной машине.
 */

declare(strict_types=1);

function crm_route_tasks(string $method, array $path): void
{
    $id = $path[0] ?? '';

    if ($id === '' && $method === 'GET') {
        $user = crm_require_user();
        crm_tasks_list($user);
    }

    if ($id === '' && $method === 'POST') {
        $user = crm_require_user();
        crm_tasks_create($user);
    }

    if ($id !== '' && $method === 'PATCH') {
        $user = crm_require_user();
        crm_tasks_update($id, $user);
    }

    if ($id !== '' && $method === 'DELETE') {
        $user = crm_require_user();
        $task = crm_one('SELECT * FROM crm_tasks WHERE id = ?', [$id]);
        if ($task === null) {
            crm_fail(404, 'not_found', 'Задача не найдена');
        }

        crm_exec('DELETE FROM crm_tasks WHERE id = ?', [$id]);
        crm_log_event((string) $task['deal_id'], (string) $user['id'], 'TASK_DELETED', (string) $task['title']);

        crm_json(['ok' => true, 'events' => crm_deal_events((string) $task['deal_id'])]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела задач');
}

/**
 * Список задач. По умолчанию — только свои и незавершённые: страница нужна,
 * чтобы понять, что делать сегодня, а не чтобы листать архив.
 */
function crm_tasks_list(array $user): void
{
    $scope = (string) ($_GET['scope'] ?? 'mine');
    $withDone = ($_GET['done'] ?? '') === '1';

    $where = [];
    $params = [];

    if ($scope !== 'all') {
        $where[] = 't.assignee_id = ?';
        $params[] = $user['id'];
    }
    if (!$withDone) {
        $where[] = 't.is_done = 0';
    }

    $sql =
        'SELECT t.*, u.name AS assignee_name, d.number AS deal_number, d.client_name AS deal_client
         FROM crm_tasks t
         LEFT JOIN crm_users u ON u.id = t.assignee_id
         LEFT JOIN crm_deals d ON d.id = t.deal_id';

    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    // Сначала то, что горит: задачи без срока уходят в конец.
    $sql .= ' ORDER BY t.is_done, (t.due_date IS NULL), t.due_date, t.created_at';

    crm_json(['ok' => true, 'tasks' => array_map('crm_task_json', crm_all($sql, $params))]);
}

function crm_tasks_create(array $user): void
{
    $body = crm_body();

    $dealId = crm_str($body, 'dealId', 64);
    if (crm_one('SELECT id FROM crm_deals WHERE id = ?', [$dealId]) === null) {
        crm_fail(404, 'deal_not_found', 'Сделка не найдена');
    }

    $title = crm_str($body, 'title', 500);
    if ($title === '') {
        crm_fail(422, 'empty_title', 'Опишите, что нужно сделать');
    }

    $assigneeId = crm_str($body, 'assigneeId', 64);
    if ($assigneeId === '' || crm_one('SELECT id FROM crm_users WHERE id = ?', [$assigneeId]) === null) {
        $assigneeId = (string) $user['id'];
    }

    $id = crm_id();
    $now = crm_now();

    crm_exec(
        'INSERT INTO crm_tasks (id, deal_id, assignee_id, author_id, title, due_date, is_done, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
        [$id, $dealId, $assigneeId, $user['id'], $title, crm_date_or_null($body, 'dueDate'), $now, $now],
    );

    crm_log_event($dealId, (string) $user['id'], 'TASK_ADDED', $title);

    crm_json(['ok' => true, 'tasks' => crm_deal_tasks($dealId), 'events' => crm_deal_events($dealId)]);
}

function crm_tasks_update(string $id, array $user): void
{
    $task = crm_one('SELECT * FROM crm_tasks WHERE id = ?', [$id]);
    if ($task === null) {
        crm_fail(404, 'not_found', 'Задача не найдена');
    }

    $body = crm_body();
    $fields = [];
    $params = [];

    if (array_key_exists('isDone', $body)) {
        $done = crm_bool($body, 'isDone');
        $fields[] = 'is_done = ?';
        $params[] = $done ? 1 : 0;
        $fields[] = 'done_at = ?';
        $params[] = $done ? crm_now() : null;

        // Отмечаем в истории только смену состояния: повторное нажатие
        // на уже выполненную задачу событием не является.
        if ($done !== (bool) $task['is_done']) {
            crm_log_event(
                (string) $task['deal_id'],
                (string) $user['id'],
                $done ? 'TASK_DONE' : 'TASK_REOPENED',
                (string) $task['title'],
            );
        }
    }

    // Правку описания и срока тоже пишем в историю: «когда сдвинули срок»
    // — вопрос, который потом задают чаще всего.
    $changed = [];

    if (array_key_exists('title', $body)) {
        $title = crm_str($body, 'title', 500);
        if ($title === '') {
            crm_fail(422, 'empty_title', 'Описание задачи не может быть пустым');
        }
        $fields[] = 'title = ?';
        $params[] = $title;
        if ($title !== (string) $task['title']) {
            $changed[] = 'описание';
        }
    }

    if (array_key_exists('dueDate', $body)) {
        $due = crm_date_or_null($body, 'dueDate');
        $fields[] = 'due_date = ?';
        $params[] = $due;
        if ((string) $due !== (string) ($task['due_date'] ?? '')) {
            $changed[] = $due === null ? 'срок снят' : 'срок — ' . $due;
        }
    }

    if (array_key_exists('assigneeId', $body)) {
        $assigneeId = crm_str($body, 'assigneeId', 64);
        if ($assigneeId !== '' && crm_one('SELECT id FROM crm_users WHERE id = ?', [$assigneeId]) !== null) {
            $fields[] = 'assignee_id = ?';
            $params[] = $assigneeId;
        }
    }

    if ($fields === []) {
        crm_fail(422, 'nothing_to_update', 'Нет полей для изменения');
    }

    $fields[] = 'updated_at = ?';
    $params[] = crm_now();
    $params[] = $id;

    crm_exec('UPDATE crm_tasks SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);

    if ($changed !== []) {
        crm_log_event(
            (string) $task['deal_id'],
            (string) $user['id'],
            'TASK_UPDATED',
            ($body['title'] ?? $task['title']) . ' (' . implode(', ', $changed) . ')',
        );
    }

    $updated = crm_one(
        'SELECT t.*, u.name AS assignee_name, d.number AS deal_number, d.client_name AS deal_client
         FROM crm_tasks t
         LEFT JOIN crm_users u ON u.id = t.assignee_id
         LEFT JOIN crm_deals d ON d.id = t.deal_id
         WHERE t.id = ?',
        [$id],
    );

    crm_json([
        'ok' => true,
        'task' => crm_task_json($updated ?? []),
        'tasks' => crm_deal_tasks((string) $task['deal_id']),
        'events' => crm_deal_events((string) $task['deal_id']),
    ]);
}
