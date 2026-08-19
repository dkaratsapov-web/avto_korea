<?php
/**
 * Публичная страница отслеживания заказа.
 *
 * Единственный метод CRM, доступный без входа. Поэтому здесь перечислено
 * ровно то, что клиенту можно показать, и ничего больше: закупочная цена,
 * курс, расходы, комиссия, источник, ссылка на лот, заметки и ответственный
 * наружу не уходят ни при каких условиях.
 */

declare(strict_types=1);

/** Этапы, которые видит клиент. Завершение и отказ показываются отдельно. */
const CRM_TRACK_STEPS = [
    'NEW' => 'Заявка принята',
    'SELECTION' => 'Подбор автомобиля',
    'APPROVAL' => 'Согласование и предоплата',
    'PURCHASED' => 'Автомобиль выкуплен',
    'SHIPPING' => 'В пути',
    'CUSTOMS' => 'Таможенное оформление',
    'DELIVERY' => 'Готов к выдаче',
];

function crm_route_track(string $method, array $path): void
{
    $token = $path[0] ?? '';
    $action = $path[1] ?? '';

    if ($method !== 'GET' || $token === '') {
        crm_fail(404, 'not_found', 'Ссылка не найдена');
    }

    $deal = crm_one('SELECT * FROM crm_deals WHERE public_token = ?', [$token]);
    if ($deal === null) {
        // Один и тот же ответ на несуществующий и на отозванный токен:
        // по различию можно было бы перебирать выданные ссылки.
        crm_fail(404, 'not_found', 'Ссылка недействительна или отозвана');
    }

    if ($action === 'photo') {
        crm_track_photo($deal, $path[2] ?? '');
    }

    if ($action !== '') {
        crm_fail(404, 'not_found', 'Ссылка не найдена');
    }

    crm_json(['ok' => true, 'deal' => crm_public_deal($deal)]);
}

/** Данные заказа для клиента. */
function crm_public_deal(array $deal): array
{
    $totals = crm_deal_totals($deal);
    $stage = (string) $deal['stage'];
    $isLost = $stage === 'LOST';
    $isClosed = $stage === 'DONE' || $isLost;

    $stages = array_keys(CRM_TRACK_STEPS);
    // У завершённой сделки пройденными считаются все этапы.
    $currentIndex = $isClosed ? count($stages) : (int) array_search($stage, $stages, true);

    $steps = [];
    foreach ($stages as $index => $code) {
        $steps[] = [
            'stage' => $code,
            'label' => CRM_TRACK_STEPS[$code],
            'done' => $index < $currentIndex,
            'current' => $index === $currentIndex,
        ];
    }

    // Фотографии — только те, что менеджер отметил как фото авто.
    $photos = crm_all(
        "SELECT id, name FROM crm_files WHERE deal_id = ? AND kind = 'PHOTO' ORDER BY created_at",
        [$deal['id']],
    );

    return [
        'number' => (int) $deal['number'],
        'clientName' => $deal['client_name'],
        'car' => trim(implode(' ', array_filter([$deal['car_brand'], $deal['car_model']]))),
        'carYear' => $deal['car_year'] === null ? null : (int) $deal['car_year'],
        'country' => $deal['country'],
        'vin' => crm_mask_vin($deal['vin']),
        'stage' => $stage,
        'stageLabel' => $isLost
            ? 'Заказ отменён'
            : ($stage === 'DONE' ? 'Автомобиль выдан' : (CRM_TRACK_STEPS[$stage] ?? '')),
        'steps' => $steps,
        'isClosed' => $isClosed,
        'isLost' => $isLost,
        'totalRub' => $totals['totalRub'],
        'paidRub' => (float) $deal['paid_amount'],
        'dueRub' => $totals['dueRub'],
        'etaDate' => $deal['eta_date'],
        'photos' => array_map(fn($p) => ['id' => $p['id'], 'name' => $p['name']], $photos),
        'updatedAt' => $deal['updated_at'],
    ];
}

/**
 * Прячет середину VIN: клиенту достаточно убедиться, что это его машина,
 * а полный номер в открытой ссылке — лишний риск.
 */
function crm_mask_vin(?string $vin): ?string
{
    if ($vin === null) {
        return null;
    }
    $trimmed = trim($vin);
    if (mb_strlen($trimmed) <= 6) {
        return $trimmed === '' ? null : $trimmed;
    }
    $hidden = str_repeat('•', max(0, mb_strlen($trimmed) - 7));
    return mb_substr($trimmed, 0, 3) . $hidden . mb_substr($trimmed, -4);
}

/** Фотография по публичной ссылке. Отдаём только вложения с типом PHOTO. */
function crm_track_photo(array $deal, string $fileId): never
{
    if ($fileId === '') {
        crm_fail(404, 'not_found', 'Файл не найден');
    }

    $file = crm_one(
        "SELECT * FROM crm_files WHERE id = ? AND deal_id = ? AND kind = 'PHOTO'",
        [$fileId, $deal['id']],
    );
    if ($file === null) {
        crm_fail(404, 'not_found', 'Файл не найден');
    }

    $content = $file['content'];
    if (is_resource($content)) {
        $content = stream_get_contents($content);
    }

    require_once __DIR__ . '/files.php';
    crm_send_file((string) $content, (string) $file['mime_type'], (string) $file['name'], true);
}
