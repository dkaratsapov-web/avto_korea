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
        crm_json(['ok' => true, 'settings' => crm_public_settings()]);
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
        ];

        // Срок поставки и предоплата здесь больше не хранятся: они
        // договариваются по каждой машине отдельно и живут в сделке.

        crm_save_settings($values);
        crm_json(['ok' => true, 'settings' => crm_public_settings()]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела реквизитов');
}
