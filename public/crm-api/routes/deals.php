<?php
/**
 * Сделки: список, карточка, создание, изменение, смена этапа, комментарии,
 * ссылка отслеживания для клиента.
 *
 * Сделки видят все сотрудники — в команде из трёх человек разграничение по
 * менеджерам мешало бы подхватывать работу друг за другом. Ограничение роли
 * начинается там, где речь о деньгах компании и доступах: разделы «Сотрудники»
 * и «Реквизиты».
 */

declare(strict_types=1);

require_once __DIR__ . '/../lib/notify.php';

/** Поля сделки, которые приходят из формы. Ключ — колонка, значение — тип. */
const CRM_DEAL_FIELDS = [
    'client_name' => 'str',
    'client_phone' => 'nullable',
    'client_telegram' => 'nullable',
    'source' => 'nullable',

    // Реквизиты клиента для договора.
    'client_full_name' => 'nullable',
    'client_birth_date' => 'date',
    'client_passport' => 'nullable',
    'client_passport_issued' => 'nullable',
    'client_address' => 'nullable',
    'client_email' => 'nullable',
    'car_brand' => 'nullable',
    'car_model' => 'nullable',
    'car_year' => 'int',
    'car_mileage' => 'int',
    'vin' => 'nullable',
    'country' => 'nullable',
    'lot_url' => 'nullable',
    'currency' => 'str',
    'car_price' => 'money',
    'exchange_rate' => 'rate',
    'delivery_cost' => 'money',
    'customs_duty' => 'money',
    'util_fee' => 'money',
    'broker_cost' => 'money',
    'other_cost' => 'money',
    'commission' => 'money',
    'paid_amount' => 'money',
    'purchase_date' => 'date',
    'eta_date' => 'date',
    'callback_at' => 'datetime',
    'delivery_days' => 'int',
    'prepayment_percent' => 'int',
    'notes' => 'nullable',
];

/** camelCase из формы для колонки snake_case. */
function crm_field_key(string $column): string
{
    return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $column))));
}

/** Читает значение поля сделки из тела запроса по описанному типу. */
function crm_deal_value(array $body, string $column, string $type): mixed
{
    $key = crm_field_key($column);

    return match ($type) {
        'money' => crm_money($body, $key),
        'rate' => crm_rate($body, $key),
        'int' => crm_int_or_null($body, $key),
        'date' => crm_date_or_null($body, $key),
        'datetime' => crm_datetime_or_null($body, $key),
        'nullable' => crm_str_or_null($body, $key, $column === 'notes' ? 5000 : 500),
        default => crm_str($body, $key, 190),
    };
}

function crm_route_deals(string $method, array $path): void
{
    $id = $path[0] ?? '';
    $action = $path[1] ?? '';

    if ($id === '' && $method === 'GET') {
        crm_require_user();
        crm_deals_list();
    }

    if ($id === '' && $method === 'POST') {
        $user = crm_require_user();
        crm_deals_create($user);
    }

    if ($id !== '' && $action === '' && $method === 'GET') {
        crm_require_user();
        crm_deals_show($id);
    }

    if ($id !== '' && $action === '' && $method === 'PATCH') {
        $user = crm_require_user();
        crm_deals_update($id, $user);
    }

    if ($id !== '' && $action === '' && $method === 'DELETE') {
        crm_require_owner();
        if (crm_one('SELECT id FROM crm_deals WHERE id = ?', [$id]) === null) {
            crm_fail(404, 'not_found', 'Сделка не найдена');
        }
        crm_exec('DELETE FROM crm_deals WHERE id = ?', [$id]);
        crm_json(['ok' => true]);
    }

    if ($id !== '' && $action === 'stage' && $method === 'POST') {
        $user = crm_require_user();
        crm_deals_set_stage($id, $user);
    }

    if ($id !== '' && $action === 'comment' && $method === 'POST') {
        $user = crm_require_user();
        $text = crm_str(crm_body(), 'text', 3000);
        if ($text === '') {
            crm_fail(422, 'empty_comment', 'Комментарий не может быть пустым');
        }
        if (crm_one('SELECT id FROM crm_deals WHERE id = ?', [$id]) === null) {
            crm_fail(404, 'not_found', 'Сделка не найдена');
        }

        crm_log_event($id, (string) $user['id'], 'COMMENT', $text);

        $deal = crm_one('SELECT * FROM crm_deals WHERE id = ?', [$id]);
        if ($deal !== null && (string) $deal['manager_id'] !== (string) $user['id']) {
            crm_notify_user(
                (string) $deal['manager_id'],
                'Комментарий к сделке №' . (int) $deal['number'],
                (string) $user['name'] . ': ' . mb_substr($text, 0, 300),
                crm_deal_url($id),
            );
        }

        crm_json(['ok' => true, 'events' => crm_deal_events($id)]);
    }

    if ($id !== '' && $action === 'token' && $method === 'POST') {
        $user = crm_require_user();
        crm_deals_token($id, $user);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела сделок');
}

/**
 * Список сделок для доски.
 *
 * Отдаём все сразу: у бизнеса это сотни строк, а не десятки тысяч, зато
 * доска, поиск и фильтр работают мгновенно и без дозапросов.
 */
function crm_deals_list(): void
{
    $rows = crm_all(
        'SELECT d.*, u.name AS manager_name
         FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id
         ORDER BY d.updated_at DESC',
    );

    // Метка горящих задач: считаем одним запросом, чтобы не ходить в базу
    // по разу на каждую карточку.
    $today = gmdate('Y-m-d');
    $due = crm_all(
        'SELECT deal_id, COUNT(*) AS n FROM crm_tasks
         WHERE is_done = 0 AND due_date IS NOT NULL AND due_date <= ?
         GROUP BY deal_id',
        [$today],
    );
    $dueMap = [];
    foreach ($due as $row) {
        $dueMap[(string) $row['deal_id']] = (int) $row['n'];
    }

    $deals = [];
    foreach ($rows as $row) {
        $deal = crm_deal_json($row);
        $deal['dueTasks'] = $dueMap[(string) $row['id']] ?? 0;
        $deals[] = $deal;
    }

    crm_json(['ok' => true, 'deals' => $deals]);
}

function crm_deals_show(string $id): void
{
    $row = crm_one(
        'SELECT d.*, u.name AS manager_name
         FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id
         WHERE d.id = ?',
        [$id],
    );
    if ($row === null) {
        crm_fail(404, 'not_found', 'Сделка не найдена');
    }

    crm_json([
        'ok' => true,
        'deal' => crm_deal_json($row),
        'events' => crm_deal_events($id),
        'tasks' => crm_deal_tasks($id),
        'files' => crm_deal_files($id),
    ]);
}

function crm_deals_create(array $user): void
{
    $body = crm_body();

    $clientName = crm_str($body, 'clientName', 190);
    if ($clientName === '') {
        crm_fail(422, 'bad_client', 'Укажите имя клиента');
    }

    $managerId = crm_str($body, 'managerId', 64);
    if ($managerId === '' || crm_one('SELECT id FROM crm_users WHERE id = ?', [$managerId]) === null) {
        $managerId = (string) $user['id'];
    }

    $columns = ['id', 'number', 'stage', 'manager_id', 'created_at', 'updated_at'];
    $values = [];
    $params = [];

    foreach (CRM_DEAL_FIELDS as $column => $type) {
        $columns[] = $column;
        $params[] = crm_deal_value($body, $column, $type);
    }

    $id = crm_id();
    $now = crm_now();
    $stage = crm_enum($body, 'stage', CRM_STAGES, 'NEW');

    $pdo = crm_db();
    $pdo->beginTransaction();
    try {
        $number = crm_next_deal_number();
        $head = [$id, $number, $stage, $managerId, $now, $now];
        $values = array_merge($head, $params);

        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        crm_exec(
            'INSERT INTO crm_deals (' . implode(', ', $columns) . ') VALUES (' . $placeholders . ')',
            $values,
        );
        crm_log_event($id, (string) $user['id'], 'CREATED', null, null, $stage);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $created = crm_one(
        'SELECT d.*, u.name AS manager_name FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id WHERE d.id = ?',
        [$id],
    );

    $car = trim(implode(' ', array_filter([$created['car_brand'] ?? null, $created['car_model'] ?? null])));
    crm_notify_all(
        'Новая сделка №' . (int) ($created['number'] ?? 0),
        $clientName . ($car !== '' ? ' · ' . $car : '') . "\nОтветственный: " . (string) ($created['manager_name'] ?? '—'),
        (string) $user['id'],
        crm_deal_url($id),
    );

    crm_json(['ok' => true, 'deal' => crm_deal_json($created ?? [])]);
}

function crm_deals_update(string $id, array $user): void
{
    $existing = crm_one('SELECT * FROM crm_deals WHERE id = ?', [$id]);
    if ($existing === null) {
        crm_fail(404, 'not_found', 'Сделка не найдена');
    }

    $body = crm_body();
    $fields = [];
    $params = [];
    $changed = [];

    foreach (CRM_DEAL_FIELDS as $column => $type) {
        $key = crm_field_key($column);
        if (!array_key_exists($key, $body)) {
            continue;
        }

        $value = crm_deal_value($body, $column, $type);
        $fields[] = "$column = ?";
        $params[] = $value;

        // Сравниваем как строки: из базы числа приходят строками в MySQL
        // и числами в SQLite, а разница «0» и «0.0» историю только засоряет.
        if ((string) ($existing[$column] ?? '') !== (string) ($value ?? '')) {
            $changed[] = $key;
        }
    }

    if (array_key_exists('managerId', $body)) {
        $managerId = crm_str($body, 'managerId', 64);
        if ($managerId !== '' && crm_one('SELECT id FROM crm_users WHERE id = ?', [$managerId]) !== null) {
            $fields[] = 'manager_id = ?';
            $params[] = $managerId;
            if ($managerId !== (string) $existing['manager_id']) {
                $changed[] = 'ответственный';
            }
        }
    }

    if ($fields === []) {
        crm_fail(422, 'nothing_to_update', 'Нет полей для изменения');
    }

    $fields[] = 'updated_at = ?';
    $params[] = crm_now();
    $params[] = $id;

    crm_exec('UPDATE crm_deals SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);

    if ($changed !== []) {
        crm_log_event($id, (string) $user['id'], 'UPDATED', implode(', ', array_slice($changed, 0, 12)));
    }

    $updated = crm_one(
        'SELECT d.*, u.name AS manager_name FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id WHERE d.id = ?',
        [$id],
    );
    crm_json(['ok' => true, 'deal' => crm_deal_json($updated ?? []), 'events' => crm_deal_events($id)]);
}

function crm_deals_set_stage(string $id, array $user): void
{
    $existing = crm_one('SELECT * FROM crm_deals WHERE id = ?', [$id]);
    if ($existing === null) {
        crm_fail(404, 'not_found', 'Сделка не найдена');
    }

    $stage = crm_enum(crm_body(), 'stage', CRM_STAGES);
    $from = (string) $existing['stage'];

    if ($from === $stage) {
        crm_json(['ok' => true, 'deal' => crm_deal_json($existing), 'events' => crm_deal_events($id)]);
    }

    // Дата закрытия ставится при уходе в финальную стадию и снимается,
    // если сделку вернули в работу.
    $closedAt = in_array($stage, CRM_CLOSED_STAGES, true) ? crm_now() : null;

    crm_exec(
        'UPDATE crm_deals SET stage = ?, closed_at = ?, updated_at = ? WHERE id = ?',
        [$stage, $closedAt, crm_now(), $id],
    );
    crm_log_event($id, (string) $user['id'], 'STAGE_CHANGED', null, $from, $stage);

    // Пишем ответственному, если этап двигал кто-то другой: это его сделка,
    // и он должен узнать о движении, не заглядывая на доску.
    if ((string) $existing['manager_id'] !== (string) $user['id']) {
        crm_notify_user(
            (string) $existing['manager_id'],
            'Сделка №' . (int) $existing['number'] . ': ' . crm_stage_label($stage),
            (string) $existing['client_name'] . "\nЭтап сменил: " . (string) $user['name'],
            crm_deal_url($id),
        );
    }

    $updated = crm_one(
        'SELECT d.*, u.name AS manager_name FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id WHERE d.id = ?',
        [$id],
    );
    crm_json(['ok' => true, 'deal' => crm_deal_json($updated ?? []), 'events' => crm_deal_events($id)]);
}

/**
 * Выдача, обновление и отзыв ссылки отслеживания.
 *
 * Обнуление токена мгновенно ломает выданную клиенту ссылку — это и есть
 * способ её отозвать.
 */
function crm_deals_token(string $id, array $user): void
{
    if (crm_one('SELECT id FROM crm_deals WHERE id = ?', [$id]) === null) {
        crm_fail(404, 'not_found', 'Сделка не найдена');
    }

    $revoke = crm_bool(crm_body(), 'revoke');
    $token = $revoke ? null : bin2hex(random_bytes(16));

    crm_exec('UPDATE crm_deals SET public_token = ?, updated_at = ? WHERE id = ?', [$token, crm_now(), $id]);
    crm_log_event(
        $id,
        (string) $user['id'],
        'UPDATED',
        $revoke ? 'ссылка отслеживания отозвана' : 'выдана ссылка отслеживания',
    );

    crm_json(['ok' => true, 'publicToken' => $token]);
}
