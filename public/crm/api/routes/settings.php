<?php
/**
 * Реквизиты компании для счетов и договоров.
 *
 * Читать может любой сотрудник — без реквизитов не собрать документ.
 * Менять только владелец: это данные, под которыми компания подписывается.
 */

declare(strict_types=1);

function crm_route_settings(string $method, array $path): void
{
    if ($method === 'GET') {
        crm_require_user();
        crm_json(['ok' => true, 'settings' => crm_settings()]);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        crm_require_owner();
        $body = crm_body();

        $values = [
            'companyName' => crm_str($body, 'companyName', 190),
            'legalForm' => crm_str($body, 'legalForm', 32),
            'inn' => crm_str($body, 'inn', 20),
            'ogrn' => crm_str($body, 'ogrn', 20),
            'legalAddress' => crm_str($body, 'legalAddress', 300),
            'phone' => crm_str($body, 'phone', 64),
            'email' => crm_str($body, 'email', 190),
            'bankName' => crm_str($body, 'bankName', 190),
            'bankAccount' => crm_str($body, 'bankAccount', 34),
            'bankCorr' => crm_str($body, 'bankCorr', 34),
            'bankBic' => crm_str($body, 'bankBic', 12),
            'signerName' => crm_str($body, 'signerName', 190),
            'signerPosition' => crm_str($body, 'signerPosition', 120),
            // Границы намеренно широкие: договор бывает и на две недели,
            // и на полгода, а предоплата — от символической до полной.
            'deliveryDays' => max(1, min(365, (int) ($body['deliveryDays'] ?? 60))),
            'prepaymentPercent' => max(0, min(100, (int) ($body['prepaymentPercent'] ?? 50))),
        ];

        crm_json(['ok' => true, 'settings' => crm_save_settings($values)]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела реквизитов');
}
