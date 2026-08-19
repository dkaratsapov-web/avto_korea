<?php
/**
 * Браузерные push-уведомления (Web Push).
 *
 * Реализовано на голом PHP с openssl: тянуть composer на общий хостинг ради
 * одной функции не хочется, а всё нужное — ECDH на кривой P-256, HKDF и
 * AES-128-GCM — в openssl уже есть.
 *
 * Формат: шифрование aes128gcm (RFC 8188 и RFC 8291), авторизация VAPID
 * (RFC 8292). Правильность проверяется тестом: PHP шифрует, Node расшифровывает
 * тем же ключом. Собственную криптографию нельзя считать рабочей, пока
 * встречная сторона не прочла сообщение.
 *
 * Ограничение, о котором важно помнить: на iPhone push приходит только у сайта,
 * добавленного на домашний экран, и молча отключается, если иконку удалить.
 * Поэтому это дополнение к Telegram, а не замена ему.
 */

declare(strict_types=1);

require_once __DIR__ . '/boot.php';

/** Файл с парой ключей VAPID. Лежит рядом с базой, вне каталога сайта. */
function crm_vapid_file(): string
{
    return CRM_DATA_DIR . '/vapid.json';
}

/**
 * Пара ключей VAPID: создаётся один раз и живёт вечно.
 *
 * Менять её нельзя без потери всех подписок: браузер привязывает подписку
 * к публичному ключу, и после смены сервер перестаёт иметь право слать.
 */
function crm_vapid_keys(): ?array
{
    static $keys = null;
    if ($keys !== null) {
        return $keys;
    }

    crm_ensure_data_dir();

    if (is_file(crm_vapid_file())) {
        $stored = json_decode((string) @file_get_contents(crm_vapid_file()), true);
        if (is_array($stored) && isset($stored['private'], $stored['public'])) {
            return $keys = $stored;
        }
    }

    $pkey = @openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if ($pkey === false) {
        return null;
    }

    openssl_pkey_export($pkey, $pem);
    $details = openssl_pkey_get_details($pkey);
    if (!isset($details['ec']['x'], $details['ec']['y'])) {
        return null;
    }

    $generated = [
        'private' => $pem,
        'public' => crm_b64url(crm_ec_point($details['ec']['x'], $details['ec']['y'])),
    ];

    @file_put_contents(crm_vapid_file(), json_encode($generated), LOCK_EX);
    @chmod(crm_vapid_file(), 0600);

    return $keys = $generated;
}

/** Публичный ключ для браузера. Его подставляют в подписку. */
function crm_vapid_public(): ?string
{
    $keys = crm_vapid_keys();
    return $keys['public'] ?? null;
}

/* --------------------------------------------------------------- мелочи ---- */

function crm_b64url(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function crm_b64url_decode(string $text): string
{
    $padded = strtr($text, '-_', '+/');
    $remainder = strlen($padded) % 4;
    if ($remainder !== 0) {
        $padded .= str_repeat('=', 4 - $remainder);
    }
    return (string) base64_decode($padded, true);
}

/** Несжатая точка кривой: 0x04 || X || Y, обе координаты по 32 байта. */
function crm_ec_point(string $x, string $y): string
{
    return "\x04" . str_pad($x, 32, "\x00", STR_PAD_LEFT) . str_pad($y, 32, "\x00", STR_PAD_LEFT);
}

/**
 * Публичный ключ openssl из сырой точки кривой.
 *
 * Прямого способа собрать ключ из 65 байт в PHP нет, поэтому склеиваем
 * DER-обёртку SubjectPublicKeyInfo вручную: постоянный заголовок для
 * prime256v1 плюс сама точка.
 */
function crm_ec_public_key(string $point): mixed
{
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";

    return openssl_pkey_get_public($pem);
}

/** HKDF по RFC 5869. В openssl-обвязке PHP его нет, но он в две строки. */
function crm_hkdf(string $salt, string $ikm, string $info, int $length): string
{
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $output = '';
    $previous = '';
    for ($i = 1; strlen($output) < $length; $i++) {
        $previous = hash_hmac('sha256', $previous . $info . chr($i), $prk, true);
        $output .= $previous;
    }
    return substr($output, 0, $length);
}

/* ------------------------------------------------------------- шифрование -- */

/**
 * Шифрует сообщение для конкретной подписки (RFC 8291).
 *
 * @param string $p256dh публичный ключ браузера, base64url
 * @param string $auth   секрет подписки, base64url
 * @return string|null тело запроса в кодировке aes128gcm
 */
function crm_push_encrypt(string $payload, string $p256dh, string $auth, ?string $forceSalt = null, mixed $forceKey = null): ?string
{
    $uaPublic = crm_b64url_decode($p256dh);
    $authSecret = crm_b64url_decode($auth);
    if (strlen($uaPublic) !== 65 || strlen($authSecret) < 16) {
        return null;
    }

    // Одноразовая пара ключей на каждое сообщение — требование формата.
    $local = $forceKey ?? @openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if ($local === false || $local === null) {
        return null;
    }

    $localDetails = openssl_pkey_get_details($local);
    if (!isset($localDetails['ec']['x'], $localDetails['ec']['y'])) {
        return null;
    }
    $localPublic = crm_ec_point($localDetails['ec']['x'], $localDetails['ec']['y']);

    $peer = crm_ec_public_key($uaPublic);
    if ($peer === false) {
        return null;
    }

    $shared = @openssl_pkey_derive($peer, $local, 32);
    if (!is_string($shared)) {
        return null;
    }

    // Общий ключ смешивается с секретом подписки: без него сообщение смог бы
    // прочесть любой, кто перехватил публичные ключи.
    $ikm = crm_hkdf(
        $authSecret,
        $shared,
        "WebPush: info\x00" . $uaPublic . $localPublic,
        32,
    );

    $salt = $forceSalt ?? random_bytes(16);
    $cek = crm_hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
    $nonce = crm_hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);

    // 0x02 — признак последней записи. Запись здесь всегда одна: сообщения
    // короткие и в один блок помещаются с запасом.
    $tag = '';
    $ciphertext = openssl_encrypt(
        $payload . "\x02",
        'aes-128-gcm',
        $cek,
        OPENSSL_RAW_DATA,
        $nonce,
        $tag,
    );
    if ($ciphertext === false) {
        return null;
    }

    // Заголовок записи: соль, размер блока, длина и сам публичный ключ отправителя.
    return $salt
        . pack('N', 4096)
        . chr(strlen($localPublic))
        . $localPublic
        . $ciphertext
        . $tag;
}

/* ------------------------------------------------------------------ VAPID -- */

/** Подпись ES256: openssl отдаёт DER, а протоколу нужны сырые r и s. */
function crm_der_to_raw_signature(string $der): ?string
{
    $offset = 0;
    if (($der[$offset++] ?? '') !== "\x30") {
        return null;
    }
    // Длина последовательности: короткая или одна дополнительная восьмёрка.
    $lengthByte = ord($der[$offset++] ?? "\x00");
    if ($lengthByte > 0x80) {
        $offset += $lengthByte - 0x80;
    }

    $read = static function (string $der, int &$offset): ?string {
        if (($der[$offset++] ?? '') !== "\x02") {
            return null;
        }
        $length = ord($der[$offset++] ?? "\x00");
        $value = substr($der, $offset, $length);
        $offset += $length;
        // DER добавляет ведущий ноль, чтобы число не выглядело отрицательным.
        return str_pad(ltrim($value, "\x00"), 32, "\x00", STR_PAD_LEFT);
    };

    $r = $read($der, $offset);
    $s = $read($der, $offset);

    return $r === null || $s === null ? null : $r . $s;
}

/** Заголовок Authorization для запроса к службе доставки. */
function crm_vapid_header(string $endpoint, string $subject): ?string
{
    $keys = crm_vapid_keys();
    if ($keys === null) {
        return null;
    }

    $parts = parse_url($endpoint);
    if (!isset($parts['scheme'], $parts['host'])) {
        return null;
    }
    $audience = $parts['scheme'] . '://' . $parts['host'];

    $header = crm_b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = crm_b64url(json_encode([
        'aud' => $audience,
        // Двенадцать часов: службы доставки не принимают токены длиннее суток.
        'exp' => time() + 12 * 3600,
        'sub' => $subject,
    ]));

    $signingInput = $header . '.' . $claims;
    $privateKey = openssl_pkey_get_private($keys['private']);
    if ($privateKey === false) {
        return null;
    }

    $der = '';
    if (!openssl_sign($signingInput, $der, $privateKey, OPENSSL_ALGO_SHA256)) {
        return null;
    }

    $raw = crm_der_to_raw_signature($der);
    if ($raw === null) {
        return null;
    }

    return 'vapid t=' . $signingInput . '.' . crm_b64url($raw) . ', k=' . $keys['public'];
}

/* ---------------------------------------------------------------- отправка -- */

/** Отправляет push всем устройствам сотрудника. */
function crm_push_send(string $userId, string $title, string $body, ?string $url = null): void
{
    if (crm_vapid_public() === null) {
        return;
    }

    $subscriptions = crm_all('SELECT * FROM crm_push WHERE user_id = ?', [$userId]);
    if ($subscriptions === []) {
        return;
    }

    $payload = json_encode(
        ['title' => $title, 'body' => $body, 'url' => $url],
        JSON_UNESCAPED_UNICODE,
    );

    $subject = 'mailto:' . ((crm_settings()['email'] ?? '') ?: 'crm@localhost');

    foreach ($subscriptions as $subscription) {
        $encrypted = crm_push_encrypt(
            (string) $payload,
            (string) $subscription['p256dh'],
            (string) $subscription['auth'],
        );
        if ($encrypted === null) {
            continue;
        }

        $authorization = crm_vapid_header((string) $subscription['endpoint'], $subject);
        if ($authorization === null) {
            continue;
        }

        $code = crm_push_post((string) $subscription['endpoint'], $encrypted, $authorization);

        // 404 и 410 означают, что подписки больше нет: браузер её отозвал или
        // человек удалил приложение. Такую запись надо убрать, иначе она будет
        // отниматься время на каждой отправке до скончания веков.
        if ($code === 404 || $code === 410) {
            crm_exec('DELETE FROM crm_push WHERE id = ?', [$subscription['id']]);
        } elseif ($code >= 400) {
            crm_exec('UPDATE crm_push SET failed_at = ? WHERE id = ?', [crm_now(), $subscription['id']]);
            crm_notify_log('push ' . $code . ' ' . substr((string) $subscription['endpoint'], 0, 60));
        }
    }
}

function crm_push_post(string $endpoint, string $body, string $authorization): int
{
    if (!function_exists('curl_init')) {
        return 0;
    }

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'TTL: 86400',
            'Urgency: normal',
            'Authorization: ' . $authorization,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    return $code;
}
