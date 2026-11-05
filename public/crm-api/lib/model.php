<?php
/**
 * Представление сделки: расчёт сумм, преобразование строки базы в JSON,
 * история изменений.
 *
 * Расчёт продублирован в интерфейсе (src/crm/lib/money.ts), потому что суммы
 * нужно показывать во время ввода, до сохранения. Формула одна и та же и
 * покрыта тестами с обеих сторон.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

const CRM_STAGES = [
    'NEW',
    'SELECTION',
    'APPROVAL',
    'PURCHASED',
    'SHIPPING',
    'CUSTOMS',
    'DELIVERY',
    'DONE',
    'LOST',
];

/** Стадии, после которых сделка считается закрытой. */
const CRM_CLOSED_STAGES = ['DONE', 'LOST'];

/**
 * Виды записей в истории сделки.
 *
 * Задачи и файлы попадают сюда наравне с этапами и комментариями: история
 * должна отвечать на вопрос «что вообще происходило по этой машине», а не
 * только «как двигали этап». Иначе, чтобы понять, когда прислали фото или
 * кто закрыл задачу, приходится держать это в голове.
 */
const CRM_EVENT_TYPES = [
    'CREATED',
    'STAGE_CHANGED',
    'UPDATED',
    'COMMENT',
    'TASK_ADDED',
    'TASK_UPDATED',
    'TASK_DONE',
    'TASK_REOPENED',
    'TASK_DELETED',
    'FILE_ADDED',
    'FILE_DELETED',
];

/** Названия этапов для уведомлений. В интерфейсе свой список, здесь — свой. */
const CRM_STAGE_LABELS = [
    'NEW' => 'Новая заявка',
    'SELECTION' => 'Подбор авто',
    'APPROVAL' => 'Согласование и предоплата',
    'PURCHASED' => 'Куплено на аукционе',
    'SHIPPING' => 'В пути',
    'CUSTOMS' => 'Таможня',
    'DELIVERY' => 'Выдача клиенту',
    'DONE' => 'Сделка завершена',
    'LOST' => 'Отказ',
];

function crm_stage_label(string $stage): string
{
    return CRM_STAGE_LABELS[$stage] ?? $stage;
}

const CRM_FILE_KINDS = ['PHOTO', 'INVOICE', 'CONTRACT', 'CUSTOMS', 'CLIENT_DOC', 'OTHER'];

function crm_round2(float $value): float
{
    return round($value, 2);
}

/**
 * Суммы по сделке.
 *
 * Курс 0 означает «курс ещё не задан»: цену авто в рубли не пересчитываем,
 * чтобы сумма сделки не обнулялась в момент, когда менеджер ввёл цену,
 * но не успел ввести курс.
 */
function crm_deal_totals(array $deal): array
{
    $rate = (float) ($deal['exchange_rate'] ?? 0);
    $carPriceRub = $rate > 0 ? (float) ($deal['car_price'] ?? 0) * $rate : 0.0;

    $costRub = $carPriceRub
        + (float) ($deal['delivery_cost'] ?? 0)
        + (float) ($deal['customs_duty'] ?? 0)
        + (float) ($deal['util_fee'] ?? 0)
        + (float) ($deal['broker_cost'] ?? 0)
        + (float) ($deal['other_cost'] ?? 0);

    $commission = (float) ($deal['commission'] ?? 0);
    $totalRub = $costRub + $commission;
    $dueRub = $totalRub - (float) ($deal['paid_amount'] ?? 0);

    return [
        'carPriceRub' => crm_round2($carPriceRub),
        'costRub' => crm_round2($costRub),
        'totalRub' => crm_round2($totalRub),
        'dueRub' => crm_round2($dueRub),
        'profitRub' => crm_round2($commission),
    ];
}

/** Строка сделки в вид, понятный интерфейсу. */
function crm_deal_json(array $row, ?array $manager = null): array
{
    return [
        'id' => $row['id'],
        'number' => (int) $row['number'],
        'stage' => $row['stage'],
        'managerId' => $row['manager_id'],
        'managerName' => $manager['name'] ?? ($row['manager_name'] ?? null),

        'clientName' => $row['client_name'],
        'clientPhone' => $row['client_phone'],
        'clientTelegram' => $row['client_telegram'],
        'source' => $row['source'],

        'clientFullName' => $row['client_full_name'] ?? null,
        'clientBirthDate' => $row['client_birth_date'] ?? null,
        'clientPassport' => $row['client_passport'] ?? null,
        'clientPassportIssued' => $row['client_passport_issued'] ?? null,
        'clientAddress' => $row['client_address'] ?? null,
        'clientEmail' => $row['client_email'] ?? null,

        'carBrand' => $row['car_brand'],
        'carModel' => $row['car_model'],
        'carYear' => $row['car_year'] === null ? null : (int) $row['car_year'],
        'carMileage' => $row['car_mileage'] === null ? null : (int) $row['car_mileage'],
        'vin' => $row['vin'],
        'country' => $row['country'],
        'lotUrl' => $row['lot_url'],

        'currency' => $row['currency'],
        'carPrice' => (float) $row['car_price'],
        'exchangeRate' => (float) $row['exchange_rate'],
        'deliveryCost' => (float) $row['delivery_cost'],
        'customsDuty' => (float) $row['customs_duty'],
        'utilFee' => (float) $row['util_fee'],
        'brokerCost' => (float) $row['broker_cost'],
        'otherCost' => (float) $row['other_cost'],
        'commission' => (float) $row['commission'],
        'paidAmount' => (float) $row['paid_amount'],

        'purchaseDate' => $row['purchase_date'],
        'etaDate' => $row['eta_date'],
        'callbackAt' => $row['callback_at'] ?? null,
        'closedAt' => $row['closed_at'],

        // Условия договора: у каждой машины свои, поэтому живут в сделке,
        // а не в реквизитах компании.
        'deliveryDays' => isset($row['delivery_days']) && $row['delivery_days'] !== null
            ? (int) $row['delivery_days']
            : null,
        'prepaymentPercent' => isset($row['prepayment_percent']) && $row['prepayment_percent'] !== null
            ? (int) $row['prepayment_percent']
            : null,

        'notes' => $row['notes'],
        'publicToken' => $row['public_token'],

        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],

        'totals' => crm_deal_totals($row),
    ];
}

/** Запись в историю сделки. */
function crm_log_event(
    string $dealId,
    ?string $userId,
    string $type,
    ?string $text = null,
    ?string $from = null,
    ?string $to = null,
): void {
    crm_exec(
        'INSERT INTO crm_events (id, deal_id, user_id, type, text, from_value, to_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [crm_id(), $dealId, $userId, $type, $text, $from, $to, crm_now()],
    );
}

/**
 * Следующий номер сделки.
 *
 * Автоинкремент не используется: номер должен быть виден в документах и
 * одинаково работать в SQLite и MySQL. Вызывается внутри транзакции, поэтому
 * два менеджера не получат один номер.
 */
function crm_next_deal_number(): int
{
    $row = crm_one('SELECT MAX(number) AS n FROM crm_deals');
    return (int) ($row['n'] ?? 0) + 1;
}

/**
 * История сделки с именами авторов.
 *
 * Живёт в общем модуле, а не в маршруте сделок: её возвращают и задачи,
 * и файлы, а роутер подключает только тот файл маршрута, который совпал
 * с адресом. Пока функция лежала в deals.php, любое создание задачи
 * заканчивалось пятисотой — причём уже после записи в базу.
 */
function crm_deal_events(string $dealId): array
{
    $rows = crm_all(
        'SELECT e.*, u.name AS user_name FROM crm_events e
         LEFT JOIN crm_users u ON u.id = e.user_id
         WHERE e.deal_id = ? ORDER BY e.created_at DESC, e.id DESC',
        [$dealId],
    );

    return array_map(fn($row) => [
        'id' => $row['id'],
        'type' => $row['type'],
        'text' => $row['text'],
        'from' => $row['from_value'],
        'to' => $row['to_value'],
        'userName' => $row['user_name'],
        'createdAt' => $row['created_at'],
    ], $rows);
}

/**
 * Задачи по сделке. Лежит здесь, а не в маршруте задач, потому что карточка
 * сделки отдаёт их вместе с остальными данными одним ответом.
 */
function crm_deal_tasks(string $dealId): array
{
    $rows = crm_all(
        'SELECT t.*, u.name AS assignee_name FROM crm_tasks t
         LEFT JOIN crm_users u ON u.id = t.assignee_id
         WHERE t.deal_id = ?
         ORDER BY t.is_done, (t.due_date IS NULL), t.due_date, t.created_at',
        [$dealId],
    );

    return array_map('crm_task_json', $rows);
}

function crm_task_json(array $row): array
{
    return [
        'id' => $row['id'],
        'dealId' => $row['deal_id'],
        'dealNumber' => isset($row['deal_number']) ? (int) $row['deal_number'] : null,
        'dealClient' => $row['deal_client'] ?? null,
        'assigneeId' => $row['assignee_id'],
        'assigneeName' => $row['assignee_name'] ?? null,
        'title' => $row['title'],
        'dueDate' => $row['due_date'],
        'isDone' => (bool) $row['is_done'],
        'doneAt' => $row['done_at'],
        'createdAt' => $row['created_at'],
        'urgency' => crm_task_urgency($row),
    ];
}

/**
 * Срочность задачи: по ней интерфейс красит строку и считает «горящие».
 * Считаем на сервере, чтобы список задач и метка на карточке сделки
 * не разошлись из-за часового пояса браузера.
 */
function crm_task_urgency(array $row): string
{
    if ((bool) $row['is_done']) {
        return 'done';
    }
    $due = $row['due_date'] ?? null;
    if ($due === null || $due === '') {
        return 'someday';
    }

    $today = gmdate('Y-m-d');
    if ($due < $today) {
        return 'overdue';
    }
    if ($due === $today) {
        return 'today';
    }
    return 'planned';
}

/** Вложения сделки. Содержимое файлов, разумеется, в списке не отдаём. */
function crm_deal_files(string $dealId): array
{
    $rows = crm_all(
        'SELECT f.id, f.deal_id, f.name, f.mime_type, f.size, f.kind, f.created_at, u.name AS uploader_name
         FROM crm_files f
         LEFT JOIN crm_users u ON u.id = f.uploaded_by
         WHERE f.deal_id = ? ORDER BY f.created_at DESC',
        [$dealId],
    );

    return array_map(fn($row) => [
        'id' => $row['id'],
        'name' => $row['name'],
        'mimeType' => $row['mime_type'],
        'size' => (int) $row['size'],
        'kind' => $row['kind'],
        'uploaderName' => $row['uploader_name'],
        'createdAt' => $row['created_at'],
    ], $rows);
}

/** Настройки компании. В таблице всегда одна строка. */
function crm_settings(): array
{
    $defaults = [
        'companyName' => '',
        'legalForm' => 'ИП',
        'inn' => '',
        'ogrn' => '',
        'legalAddress' => '',
        'phone' => '',
        'email' => '',
        'bankName' => '',
        'bankAccount' => '',
        'bankCorr' => '',
        'bankBic' => '',
        'signerName' => '',
        'signerPosition' => 'Директор',
        'deliveryDays' => 60,
        'prepaymentPercent' => 50,
    ];

    $row = crm_one('SELECT data FROM crm_settings WHERE id = ?', ['main']);
    if ($row === null) {
        return $defaults;
    }

    $stored = json_decode((string) $row['data'], true);
    return is_array($stored) ? array_merge($defaults, $stored) : $defaults;
}

/**
 * Настройки для отдачи наружу.
 *
 * Токен бота вырезается: показать его на экране — значит однажды показать
 * на скриншоте. Интерфейсу достаточно знать, настроен канал или нет.
 */
function crm_public_settings(): array
{
    $settings = crm_settings();
    // Секреты наружу не отдаются никогда: токен бота уведомлений и ключ,
    // которым CRM ходит к отзывам. Интерфейсу достаточно знать, настроено или нет.
    unset($settings['telegramToken'], $settings['botReviewsKey'], $settings['botAdminKey']);
    return $settings;
}

function crm_save_settings(array $values): array
{
    $merged = array_merge(crm_settings(), $values);
    $payload = json_encode($merged, JSON_UNESCAPED_UNICODE);

    $exists = crm_one('SELECT id FROM crm_settings WHERE id = ?', ['main']);
    if ($exists === null) {
        crm_exec('INSERT INTO crm_settings (id, data, updated_at) VALUES (?, ?, ?)', ['main', $payload, crm_now()]);
    } else {
        crm_exec('UPDATE crm_settings SET data = ?, updated_at = ? WHERE id = ?', [$payload, crm_now(), 'main']);
    }

    return $merged;
}
