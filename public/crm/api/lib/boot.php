<?php
/**
 * Общий старт для всех запросов к API CRM.
 *
 * CRM — отдельное направление внутри проекта: она не использует ни данные
 * сайта (public/api/*.php), ни воркер с ботом. Здесь свои пользователи, своя
 * база и свои сессии; ничего из этого наружу не отдаётся.
 *
 * Данные лежат ВЫШЕ каталога сайта: их не затирает выгрузка по FTP (она
 * синхронизирует только dist/) и они недоступны по HTTP, даже если однажды
 * отвалится .htaccess.
 */

declare(strict_types=1);

if (!defined('CRM_BOOTED')) {
    define('CRM_BOOTED', true);

    /**
     * Каталог данных. От /www/<домен>/crm/api/lib/ поднимаемся на четыре
     * уровня — до /www/, где рядом с сайтом уже лежит private-leads.
     */
    define('CRM_DATA_DIR', __DIR__ . '/../../../../private-crm');

    define('CRM_DB_FILE', CRM_DATA_DIR . '/crm.sqlite');
    define('CRM_KEY_FILE', CRM_DATA_DIR . '/session.key');
    define('CRM_CONFIG_FILE', CRM_DATA_DIR . '/config.php');

    /** Имя куки сессии. Своё, чтобы не пересекаться с сайтом. */
    define('CRM_COOKIE', 'crm_session');

    /** Сколько живёт сессия без активности. */
    define('CRM_SESSION_TTL', 14 * 24 * 3600);

    mb_internal_encoding('UTF-8');
    date_default_timezone_set('UTC');
}

/**
 * Создаёт каталог данных при первом обращении.
 * Права 0700: содержимое видит только владелец процесса.
 */
function crm_ensure_data_dir(): void
{
    if (is_dir(CRM_DATA_DIR)) {
        return;
    }
    if (!@mkdir(CRM_DATA_DIR, 0700, true) && !is_dir(CRM_DATA_DIR)) {
        crm_fatal(500, 'storage_unavailable', 'Не удалось создать каталог данных CRM');
    }
    // Второй рубеж на случай, если каталог всё-таки окажется в зоне раздачи.
    @file_put_contents(CRM_DATA_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
}

/**
 * Конфигурация подключения к БД.
 *
 * По умолчанию SQLite — она не требует от владельца никаких действий: файл
 * создаётся сам при первом запросе. Если на хостинге не окажется pdo_sqlite
 * или база вырастет, достаточно положить рядом с базой config.php вида
 *
 *   <?php return ['driver' => 'mysql', 'host' => 'localhost',
 *                 'name' => 'u123_crm', 'user' => '...', 'pass' => '...'];
 *
 * и всё остальное продолжит работать без правок кода.
 */
function crm_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $defaults = ['driver' => 'sqlite', 'path' => CRM_DB_FILE];

    if (is_file(CRM_CONFIG_FILE)) {
        $loaded = require CRM_CONFIG_FILE;
        if (is_array($loaded)) {
            $defaults = array_merge($defaults, $loaded);
        }
    }

    return $config = $defaults;
}

/**
 * Ключ подписи сессионных кук. Генерируется сам при первом запуске и живёт
 * рядом с базой — переустановка сайта по FTP его не трогает.
 */
function crm_session_key(): string
{
    static $key = null;
    if ($key !== null) {
        return $key;
    }

    crm_ensure_data_dir();

    if (is_file(CRM_KEY_FILE)) {
        $stored = (string) @file_get_contents(CRM_KEY_FILE);
        if (strlen($stored) >= 32) {
            return $key = $stored;
        }
    }

    $generated = bin2hex(random_bytes(32));
    if (@file_put_contents(CRM_KEY_FILE, $generated, LOCK_EX) === false) {
        crm_fatal(500, 'storage_unavailable', 'Не удалось сохранить ключ сессий');
    }
    @chmod(CRM_KEY_FILE, 0600);

    return $key = $generated;
}

/** Текущий момент в формате, в котором время лежит в базе. */
function crm_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

/**
 * Идентификатор записи.
 *
 * Первые 14 символов — время создания в микросекундах, поэтому строки
 * сортируются по идентификатору ровно в том порядке, в котором создавались.
 * Это нужно истории сделки: несколько событий попадают в одну секунду, и без
 * подсекундной точности они выстраивались бы в случайном порядке — переход
 * этапа мог оказаться в ленте раньше комментария, написанного до него.
 *
 * Хвост из случайных байтов защищает от совпадения и делает идентификатор
 * неугадываемым.
 */
function crm_id(): string
{
    [$microseconds, $seconds] = explode(' ', microtime());

    return sprintf('%08x%06x', (int) $seconds, (int) round((float) $microseconds * 1e6))
        . bin2hex(random_bytes(6));
}
