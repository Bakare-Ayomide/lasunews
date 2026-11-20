<?php
/**
 * LASU Campus Broadcast - Core PHP Helpers & Security Utilities
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function e(string|int|float|null $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_base_path(): string
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }

    $cfg = lasu_load_config();
    if (!empty($cfg['base_url'])) {
        $parsed = parse_url((string) $cfg['base_url'], PHP_URL_PATH);
        $base = $parsed ? rtrim($parsed, '/') : '';
        return $base;
    }

    $docRoot = isset($_SERVER['DOCUMENT_ROOT']) ? realpath((string) $_SERVER['DOCUMENT_ROOT']) : false;
    $appRoot = realpath(dirname(__DIR__));

    if ($docRoot && $appRoot && str_starts_with($appRoot, $docRoot)) {
        $rel = str_replace('\\', '/', substr($appRoot, strlen($docRoot)));
        $base = rtrim($rel, '/');
        return $base;
    }

    $base = '';
    return $base;
}

function url_for(string $path = '/'): string
{
    $base = app_base_path();
    $clean = '/' . ltrim($path, '/');
    return ($base === '' ? '' : $base) . $clean;
}

function media_url(?string $path): string
{
    $p = trim((string) ($path ?? ''));
    if ($p === '') {
        return '';
    }
    if (preg_match('#^(https?:)?//#i', $p) === 1 || str_starts_with($p, 'data:')) {
        return $p;
    }
    $base = app_base_path();
    if ($base !== '' && str_starts_with($p, $base . '/')) {
        return $p;
    }
    return url_for($p);
}

function full_url_for(string $path = '/'): string
{
    $cfg = lasu_load_config();
    if (!empty($cfg['base_url'])) {
        return rtrim((string) $cfg['base_url'], '/') . '/' . ltrim($path, '/');
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $scheme = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host . url_for($path);
}

function slugify(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text) ?? '';
    $text = preg_replace('/[\s_-]+/', '-', $text) ?? '';
    $text = trim($text, '-');
    return $text !== '' ? $text : 'untitled';
}

function unique_article_slug(PDO $pdo, string $title, ?int $excludeId = null): string
{
    $base = substr(slugify($title), 0, 80);
    $candidate = $base;
    $counter = 1;

    while (true) {
        if ($excludeId !== null) {
            $stmt = $pdo->prepare('SELECT id FROM articles WHERE slug = ? AND id != ? LIMIT 1');
            $stmt->execute([$candidate, $excludeId]);
        } else {
            $stmt = $pdo->prepare('SELECT id FROM articles WHERE slug = ? LIMIT 1');
            $stmt->execute([$candidate]);
        }
        if (!$stmt->fetch()) {
            return $candidate;
        }
        $counter++;
        $candidate = $base . '-' . $counter;
    }
}

function unique_category_slug(PDO $pdo, string $name, ?int $excludeId = null): string
{
    $base = substr(slugify($name), 0, 60);
    $candidate = $base;
    $counter = 1;

    while (true) {
        if ($excludeId !== null) {
            $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = ? AND id != ? LIMIT 1');
            $stmt->execute([$candidate, $excludeId]);
        } else {
            $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = ? LIMIT 1');
            $stmt->execute([$candidate]);
        }
        if (!$stmt->fetch()) {
            return $candidate;
        }
        $counter++;
        $candidate = $base . '-' . $counter;
    }
}

function format_date(?string $datetime): string
{
    if (!$datetime) {
        return 'Unscheduled';
    }
    $ts = strtotime($datetime);
    return $ts !== false ? date('M j, Y', $ts) : $datetime;
}

function format_datetime(?string $datetime): string
{
    if (!$datetime) {
        return '—';
    }
    $ts = strtotime($datetime);
    return $ts !== false ? date('M j, Y, g:i A', $ts) : $datetime;
}

function estimate_read_time(?string $text): string
{
    if (!$text) {
        return '1 min read';
    }
    $words = str_word_count(strip_tags($text));
    $minutes = max(1, (int) ceil($words / 200));
    return $minutes . ' min read';
}

function json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function log_activity(PDO $pdo, ?int $adminId, string $action, string $entityType, ?int $entityId, string $details): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO activity_logs (admin_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$adminId, substr($action, 0, 60), substr($entityType, 0, 40), $entityId, substr($details, 0, 255)]);
}

function csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return '';
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function verify_csrf_token(?string $token): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['csrf_token']) || !$token) {
        return false;
    }
    return hash_equals((string) $_SESSION['csrf_token'], $token);
}

function request_csrf_token(array $body = []): ?string
{
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (is_string($header) && $header !== '') {
        return $header;
    }
    if (isset($body['_csrf']) && is_string($body['_csrf'])) {
        return $body['_csrf'];
    }
    if (isset($_POST['_csrf']) && is_string($_POST['_csrf'])) {
        return $_POST['_csrf'];
    }
    return null;
}

function sanitize_hex_color(?string $color, string $fallback = '#0B2545'): string
{
    $c = trim((string) $color);
    return preg_match('/^#[0-9A-Fa-f]{6}$/', $c) === 1 ? strtoupper($c) : $fallback;
}

function record_ad_impressions(PDO $pdo, array $ads): void
{
    if (empty($ads)) {
        return;
    }
    $stmt = $pdo->prepare('UPDATE advertisements SET impressions = impressions + 1 WHERE id = ?');
    foreach ($ads as $ad) {
        if (!empty($ad['id'])) {
            $stmt->execute([(int) $ad['id']]);
        }
    }
}

