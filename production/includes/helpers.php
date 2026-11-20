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

function compute_ad_expiry(?int $durationValue, string $durationUnit): array
{
    $validUnits = ['none', 'seconds', 'minutes', 'hours', 'days', 'months'];
    $unit = in_array($durationUnit, $validUnits, true) ? $durationUnit : 'none';
    $val = $durationValue !== null ? max(0, $durationValue) : 0;

    if ($unit === 'none' || $val <= 0) {
        return ['duration_value' => null, 'duration_unit' => 'none', 'expires_at' => null];
    }

    $val = min($val, 100000);
    $now = new DateTimeImmutable('now');
    $expiresAt = $now->modify("+{$val} {$unit}")->format('Y-m-d H:i:s');

    return [
        'duration_value' => $val,
        'duration_unit'  => $unit,
        'expires_at'     => $expiresAt,
    ];
}

function ad_expires_at_ms(?string $expiresAt): ?int
{
    $raw = trim((string) ($expiresAt ?? ''));
    if ($raw === '') {
        return null;
    }
    try {
        return (new DateTimeImmutable($raw))->getTimestamp() * 1000;
    } catch (Throwable) {
        return null;
    }
}

function fetch_active_ads(PDO $pdo, ?string $placement = null): array
{
    $now = date('Y-m-d H:i:s');
    $sql = "SELECT * FROM advertisements WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?)";
    $params = [$now];
    if ($placement !== null) {
        $sql .= ' AND placement = ?';
        $params[] = $placement;
    }
    $sql .= ' ORDER BY display_order ASC, created_at DESC, id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function is_rich_html(?string $content): bool
{
    if (!$content) {
        return false;
    }
    return preg_match('/<(p|br|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|a|img|figure|hr|div)\b/i', $content) === 1;
}

function sanitize_article_html(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }
    if (!is_rich_html($html)) {
        return $html;
    }

    if (!class_exists('DOMDocument')) {
        $allowed = '<p><br><h1><h2><h3><h4><strong><b><em><i><u><s><ul><ol><li><blockquote><a><img><figure><figcaption><hr><div><span>';
        $clean = strip_tags($html, $allowed);
        $clean = preg_replace('/\son[a-z]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $clean) ?? $clean;
        $clean = preg_replace('/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i', '', $clean) ?? $clean;
        return trim($clean);
    }

    $allowedTags = [
        'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's',
        'strike', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
        'hr', 'div', 'span',
    ];
    $dropCompletely = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'];

    $prevErrors = libxml_use_internal_errors(true);
    $doc = new DOMDocument('1.0', 'UTF-8');
    $wrapped = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="__lasu_rte_root">' . $html . '</div></body></html>';
    $doc->loadHTML('<?xml encoding="utf-8" ?>' . $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    libxml_use_internal_errors($prevErrors);

    $root = $doc->getElementById('__lasu_rte_root');
    if (!$root) {
        return trim(strip_tags($html, '<p><br><strong><em><u><ul><ol><li><blockquote><a><h2><h3>'));
    }

    $sanitizeNode = static function (DOMNode $node) use (&$sanitizeNode, $allowedTags, $dropCompletely): void {
        $children = [];
        foreach ($node->childNodes as $child) {
            $children[] = $child;
        }

        foreach ($children as $child) {
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);
                if (in_array($tag, $dropCompletely, true)) {
                    $node->removeChild($child);
                    continue;
                }
                if (!in_array($tag, $allowedTags, true)) {
                    $sanitizeNode($child);
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);
                    continue;
                }

                // Filter attributes safely
                $attrs = [];
                foreach ($child->attributes as $attr) {
                    $attrs[] = $attr->name;
                }
                foreach ($attrs as $attrName) {
                    $lower = strtolower($attrName);
                    $val = trim($child->getAttribute($attrName));
                    $keep = false;

                    if ($tag === 'a' && $lower === 'href') {
                        if (preg_match('#^(https?://|mailto:|/)#i', $val) === 1) {
                            $keep = true;
                        }
                    } elseif ($tag === 'a' && in_array($lower, ['target', 'rel'], true)) {
                        $keep = true;
                    } elseif ($tag === 'img' && $lower === 'src') {
                        if (preg_match('#^(https?://|/)#i', $val) === 1) {
                            $keep = true;
                        }
                    } elseif ($tag === 'img' && $lower === 'alt') {
                        $keep = true;
                    } elseif ($lower === 'style') {
                        if (preg_match('/text-align\s*:\s*(left|center|right|justify)/i', $val, $m) === 1) {
                            $child->setAttribute('style', 'text-align:' . strtolower($m[1]) . ';');
                            $keep = true;
                        }
                    }

                    if (!$keep) {
                        $child->removeAttribute($attrName);
                    }
                }

                if ($tag === 'a' && $child->hasAttribute('href')) {
                    $href = $child->getAttribute('href');
                    if (preg_match('#^https?://#i', $href) === 1) {
                        $child->setAttribute('target', '_blank');
                        $child->setAttribute('rel', 'noopener noreferrer');
                    }
                }

                if ($tag === 'img' && !$child->hasAttribute('src')) {
                    $node->removeChild($child);
                    continue;
                }

                $sanitizeNode($child);
            } elseif ($child instanceof DOMComment) {
                $node->removeChild($child);
            }
        }
    };

    $sanitizeNode($root);

    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $doc->saveHTML($child);
    }

    return trim($out);
}


