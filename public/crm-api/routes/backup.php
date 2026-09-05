<?php
/**
 * Резервные копии: список, снятие, выгрузка, восстановление.
 *
 * Раздел владельца целиком. Копия — это вся база одним файлом: и сделки
 * клиентов, и паспортные данные, и хэши паролей сотрудников. Менеджеру такое
 * не показывают даже на чтение.
 */

declare(strict_types=1);

require_once __DIR__ . '/../lib/backup.php';

function crm_route_backup(string $method, array $path): void
{
    $name = $path[0] ?? '';
    $action = $path[1] ?? '';

    // --- состояние раздела ---
    if ($name === '' && $method === 'GET') {
        crm_require_owner();
        require_once __DIR__ . '/../lib/notify.php';

        $owners = crm_all(
            "SELECT id FROM crm_users WHERE role = 'OWNER' AND telegram_chat_id IS NOT NULL AND telegram_chat_id <> ''",
        );

        crm_json([
            'ok' => true,
            'backups' => crm_backup_list(),
            // Куда уходит второй экземпляр. Копия на том же диске не спасает
            // от гибели диска, и интерфейс должен показывать это честно.
            'telegram' => crm_telegram_token() !== '' && $owners !== []
                && (crm_settings()['backupToTelegram'] ?? true) !== false,
            'everyHours' => (int) round(CRM_BACKUP_EVERY / 3600),
            'keep' => CRM_BACKUP_KEEP,
        ]);
    }

    // --- снять копию сейчас ---
    if ($name === '' && $method === 'POST') {
        crm_require_owner();
        try {
            $made = crm_backup_make('вручную');
        } catch (Throwable $e) {
            crm_fail(500, 'backup_failed', 'Не удалось снять копию: ' . $e->getMessage());
        }

        crm_json([
            'ok' => true,
            'backups' => crm_backup_list(),
            'made' => $made,
            'sent' => crm_backup_send($made['name']),
        ]);
    }

    // --- скачать ---
    if ($name !== '' && $action === '' && $method === 'GET') {
        crm_require_owner();
        $file = crm_backup_path($name);
        if ($file === null) {
            crm_fail(404, 'not_found', 'Копия не найдена');
        }

        header('Content-Type: application/gzip');
        header('Content-Length: ' . (string) filesize($file));
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Cache-Control: no-store, private');
        readfile($file);
        exit;
    }

    // --- удалить ---
    if ($name !== '' && $action === '' && $method === 'DELETE') {
        crm_require_owner();
        if (!crm_backup_remove($name)) {
            crm_fail(404, 'not_found', 'Копия не найдена');
        }
        crm_json(['ok' => true, 'backups' => crm_backup_list()]);
    }

    // --- восстановить ---
    if ($name !== '' && $action === 'restore' && $method === 'POST') {
        crm_require_owner();
        try {
            $report = crm_backup_restore($name);
        } catch (Throwable $e) {
            crm_fail(500, 'restore_failed', 'Не удалось восстановить: ' . $e->getMessage());
        }

        crm_json([
            'ok' => true,
            'backups' => crm_backup_list(),
            'restored' => $report['restored'],
            'safety' => $report['safety'],
        ]);
    }

    crm_fail(404, 'not_found', 'Неизвестный метод раздела копий');
}
