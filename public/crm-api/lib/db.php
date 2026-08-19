<?php
/**
 * Подключение к базе и миграции.
 *
 * Схема разложена на пронумерованные шаги: при каждом запросе применяются те,
 * которые ещё не выполнялись. Изменение схемы уезжает на боевой сервер вместе
 * с кодом — отдельного действия от владельца не требуется.
 *
 * SQL написан на пересечении диалектов SQLite и MySQL: типы, которые
 * различаются (автоинкремент, двоичные данные), подставляются функцией
 * crm_sql_type(). Номера сделок выдаются не автоинкрементом, а MAX+1 внутри
 * транзакции — так одинаково работает в обоих движках.
 */

declare(strict_types=1);

require_once __DIR__ . '/boot.php';
require_once __DIR__ . '/http.php';

function crm_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = crm_config();
    $driver = $config['driver'] ?? 'sqlite';

    try {
        if ($driver === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $config['host'] ?? 'localhost',
                (int) ($config['port'] ?? 3306),
                $config['name'] ?? '',
            );
            $pdo = new PDO($dsn, (string) ($config['user'] ?? ''), (string) ($config['pass'] ?? ''));
        } else {
            if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
                crm_fatal(
                    500,
                    'no_sqlite',
                    'На хостинге нет расширения pdo_sqlite. Создайте базу MySQL и положите config.php рядом с каталогом данных.',
                );
            }
            crm_ensure_data_dir();
            $pdo = new PDO('sqlite:' . ($config['path'] ?? CRM_DB_FILE));
            // Внешние ключи в SQLite выключены по умолчанию — каскадное
            // удаление вложений и задач без этого не сработает.
            $pdo->exec('PRAGMA foreign_keys = ON');
            // Общий хостинг: параллельные запросы ждут, а не падают с «database is locked».
            $pdo->exec('PRAGMA busy_timeout = 5000');
        }
    } catch (PDOException $e) {
        crm_fatal(500, 'db_unavailable', 'Не удалось подключиться к базе CRM');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

    crm_migrate($pdo);

    return $pdo;
}

/** Тип поля, который называется по-разному в SQLite и MySQL. */
function crm_sql_type(string $logical): string
{
    $mysql = (crm_config()['driver'] ?? 'sqlite') === 'mysql';

    return match ($logical) {
        'blob' => $mysql ? 'LONGBLOB' : 'BLOB',
        'text' => $mysql ? 'MEDIUMTEXT' : 'TEXT',
        default => 'TEXT',
    };
}

/** Список миграций. Ключ — версия, значение — набор запросов. */
function crm_migrations(): array
{
    $blob = crm_sql_type('blob');
    $text = crm_sql_type('text');

    return [
        1 => [
            "CREATE TABLE crm_users (
                id VARCHAR(64) PRIMARY KEY,
                email VARCHAR(190) NOT NULL,
                name VARCHAR(190) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(16) NOT NULL DEFAULT 'MANAGER',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at VARCHAR(32) NOT NULL,
                updated_at VARCHAR(32) NOT NULL
            )",
            'CREATE UNIQUE INDEX crm_users_email ON crm_users (email)',

            "CREATE TABLE crm_deals (
                id VARCHAR(64) PRIMARY KEY,
                number INTEGER NOT NULL,
                stage VARCHAR(16) NOT NULL DEFAULT 'NEW',
                manager_id VARCHAR(64) NOT NULL,

                client_name VARCHAR(190) NOT NULL,
                client_phone VARCHAR(64),
                client_telegram VARCHAR(190),
                source VARCHAR(190),

                car_brand VARCHAR(120),
                car_model VARCHAR(120),
                car_year INTEGER,
                car_mileage INTEGER,
                vin VARCHAR(64),
                country VARCHAR(64),
                lot_url VARCHAR(500),

                currency VARCHAR(8) NOT NULL DEFAULT 'USD',
                car_price REAL NOT NULL DEFAULT 0,
                exchange_rate REAL NOT NULL DEFAULT 0,
                delivery_cost REAL NOT NULL DEFAULT 0,
                customs_duty REAL NOT NULL DEFAULT 0,
                util_fee REAL NOT NULL DEFAULT 0,
                broker_cost REAL NOT NULL DEFAULT 0,
                other_cost REAL NOT NULL DEFAULT 0,
                commission REAL NOT NULL DEFAULT 0,
                paid_amount REAL NOT NULL DEFAULT 0,

                purchase_date VARCHAR(16),
                eta_date VARCHAR(16),
                closed_at VARCHAR(32),

                notes $text,
                public_token VARCHAR(64),

                created_at VARCHAR(32) NOT NULL,
                updated_at VARCHAR(32) NOT NULL
            )",
            'CREATE UNIQUE INDEX crm_deals_number ON crm_deals (number)',
            'CREATE UNIQUE INDEX crm_deals_token ON crm_deals (public_token)',
            'CREATE INDEX crm_deals_stage ON crm_deals (stage)',
            'CREATE INDEX crm_deals_manager ON crm_deals (manager_id)',

            "CREATE TABLE crm_events (
                id VARCHAR(64) PRIMARY KEY,
                deal_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64),
                type VARCHAR(24) NOT NULL,
                text $text,
                from_value VARCHAR(32),
                to_value VARCHAR(32),
                created_at VARCHAR(32) NOT NULL,
                FOREIGN KEY (deal_id) REFERENCES crm_deals (id) ON DELETE CASCADE
            )",
            'CREATE INDEX crm_events_deal ON crm_events (deal_id, created_at)',

            "CREATE TABLE crm_tasks (
                id VARCHAR(64) PRIMARY KEY,
                deal_id VARCHAR(64) NOT NULL,
                assignee_id VARCHAR(64) NOT NULL,
                author_id VARCHAR(64),
                title VARCHAR(500) NOT NULL,
                due_date VARCHAR(16),
                is_done INTEGER NOT NULL DEFAULT 0,
                done_at VARCHAR(32),
                created_at VARCHAR(32) NOT NULL,
                updated_at VARCHAR(32) NOT NULL,
                FOREIGN KEY (deal_id) REFERENCES crm_deals (id) ON DELETE CASCADE
            )",
            'CREATE INDEX crm_tasks_assignee ON crm_tasks (assignee_id, is_done)',
            'CREATE INDEX crm_tasks_deal ON crm_tasks (deal_id)',
            'CREATE INDEX crm_tasks_due ON crm_tasks (is_done, due_date)',

            "CREATE TABLE crm_files (
                id VARCHAR(64) PRIMARY KEY,
                deal_id VARCHAR(64) NOT NULL,
                uploaded_by VARCHAR(64),
                name VARCHAR(255) NOT NULL,
                mime_type VARCHAR(120) NOT NULL,
                size INTEGER NOT NULL,
                kind VARCHAR(24) NOT NULL DEFAULT 'OTHER',
                content $blob NOT NULL,
                created_at VARCHAR(32) NOT NULL,
                FOREIGN KEY (deal_id) REFERENCES crm_deals (id) ON DELETE CASCADE
            )",
            'CREATE INDEX crm_files_deal ON crm_files (deal_id, created_at)',

            "CREATE TABLE crm_settings (
                id VARCHAR(16) PRIMARY KEY,
                data $text NOT NULL,
                updated_at VARCHAR(32) NOT NULL
            )",

            "CREATE TABLE crm_sessions (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                created_at VARCHAR(32) NOT NULL,
                seen_at VARCHAR(32) NOT NULL,
                user_agent VARCHAR(255)
            )",
            'CREATE INDEX crm_sessions_user ON crm_sessions (user_id)',
        ],

        // Срок поставки и размер предоплаты договариваются по каждой машине
        // отдельно, поэтому переехали из реквизитов компании в саму сделку.
        2 => [
            'ALTER TABLE crm_deals ADD COLUMN delivery_days INTEGER',
            'ALTER TABLE crm_deals ADD COLUMN prepayment_percent INTEGER',
        ],

        // Данные клиента для договора. В карточке они нужны целиком: без
        // паспорта и адреса регистрации договор не подписать, а собирать их
        // в переписке каждый раз заново — терять время.
        3 => [
            'ALTER TABLE crm_deals ADD COLUMN client_full_name VARCHAR(255)',
            'ALTER TABLE crm_deals ADD COLUMN client_birth_date VARCHAR(16)',
            'ALTER TABLE crm_deals ADD COLUMN client_passport VARCHAR(64)',
            'ALTER TABLE crm_deals ADD COLUMN client_passport_issued VARCHAR(500)',
            'ALTER TABLE crm_deals ADD COLUMN client_address VARCHAR(500)',
            'ALTER TABLE crm_deals ADD COLUMN client_email VARCHAR(190)',
        ],

        // Уведомления: привязка сотрудника к Telegram и подписки браузера
        // на push. Каналы разные, но включаются и отключаются вместе.
        4 => [
            'ALTER TABLE crm_users ADD COLUMN telegram_chat_id VARCHAR(64)',
            'ALTER TABLE crm_users ADD COLUMN telegram_code VARCHAR(16)',
            'ALTER TABLE crm_users ADD COLUMN notify_muted INTEGER NOT NULL DEFAULT 0',

            "CREATE TABLE crm_push (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                endpoint VARCHAR(500) NOT NULL,
                p256dh VARCHAR(190) NOT NULL,
                auth VARCHAR(64) NOT NULL,
                label VARCHAR(120),
                created_at VARCHAR(32) NOT NULL,
                failed_at VARCHAR(32)
            )",
            'CREATE INDEX crm_push_user ON crm_push (user_id)',
            'CREATE UNIQUE INDEX crm_push_endpoint ON crm_push (endpoint)',
        ],

        // Дата и время перезвона. Отдельно от задач: перезвонить — не «дело
        // по машине», а обещание клиенту, и его нужно видеть на доске.
        5 => [
            'ALTER TABLE crm_deals ADD COLUMN callback_at VARCHAR(32)',
        ],
    ];
}

function crm_migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS crm_schema (version INTEGER PRIMARY KEY, applied_at VARCHAR(32) NOT NULL)');

    $applied = $pdo->query('SELECT version FROM crm_schema')->fetchAll(PDO::FETCH_COLUMN);
    $applied = array_map('intval', $applied ?: []);

    foreach (crm_migrations() as $version => $statements) {
        if (in_array((int) $version, $applied, true)) {
            continue;
        }

        // DDL в MySQL не откатывается, поэтому транзакция нужна прежде всего
        // ради SQLite: там половина применённой миграции была бы хуже, чем
        // отсутствие всей.
        $pdo->beginTransaction();
        try {
            foreach ($statements as $sql) {
                $pdo->exec($sql);
            }
            $stmt = $pdo->prepare('INSERT INTO crm_schema (version, applied_at) VALUES (?, ?)');
            $stmt->execute([$version, crm_now()]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            crm_fatal(500, 'migration_failed', 'Не удалось обновить схему базы CRM (шаг ' . $version . ')');
        }
    }
}

/** Один ряд или null. */
function crm_one(string $sql, array $params = []): ?array
{
    $stmt = crm_db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** Все ряды. */
function crm_all(string $sql, array $params = []): array
{
    $stmt = crm_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** Запрос без результата. Возвращает число затронутых строк. */
function crm_exec(string $sql, array $params = []): int
{
    $stmt = crm_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}
