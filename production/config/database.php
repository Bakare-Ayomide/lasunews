<?php
/**
 * LASU Campus Broadcast - Secure PDO MySQL Connection
 */

declare(strict_types=1);

function lasu_load_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        http_response_code(503);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Setup Required — LASU Campus Broadcast</title>'
            . '<style>body{font-family:system-ui,-apple-system,sans-serif;background:#FAF9F6;color:#14181F;padding:3rem 1.5rem;max-width:680px;margin:0 auto;line-height:1.6}code{background:#EBE6DF;padding:.15rem .4rem;border-radius:4px;font-size:.9em}h1{color:#0B2545}</style>'
            . '</head><body>'
            . '<h1>Configuration Required</h1>'
            . '<p>The configuration file <code>config/config.php</code> has not been created yet.</p>'
            . '<ol><li>Duplicate <code>config/config.example.php</code> as <code>config/config.php</code>.</li>'
            . '<li>Enter your cPanel MySQL database host, database name, username, and password.</li>'
            . '<li>Import <code>database/install.sql</code> into your database using phpMyAdmin.</li></ol>'
            . '</body></html>';
        exit;
    }

    $loaded = require $configPath;
    if (!is_array($loaded)) {
        throw new RuntimeException('Invalid config/config.php format.');
    }

    if (!empty($loaded['timezone'])) {
        date_default_timezone_set((string) $loaded['timezone']);
    }

    $config = $loaded;
    return $config;
}

function lasu_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = lasu_load_config();
    $host = $cfg['db_host'] ?? 'localhost';
    $port = $cfg['db_port'] ?? '3306';
    $name = $cfg['db_name'] ?? '';
    $user = $cfg['db_user'] ?? '';
    $pass = $cfg['db_pass'] ?? '';
    $charset = $cfg['db_charset'] ?? 'utf8mb4';

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $host, $port, $name, $charset);

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, (string) $user, (string) $pass, $options);
    } catch (PDOException $e) {
        error_log('LASU Broadcast DB connection error: ' . $e->getMessage());
        http_response_code(500);
        if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Database connection unavailable. Please verify config/config.php.']);
        } else {
            echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Database Error</title></head>'
                . '<body style="font-family:system-ui,sans-serif;padding:3rem;max-width:640px;margin:auto;background:#FAF9F6;color:#14181F;">'
                . '<h1 style="color:#0B2545;">Database Connection Error</h1>'
                . '<p>Unable to connect to MySQL. Please verify your database credentials in <code>config/config.php</code> and ensure <code>database/install.sql</code> has been imported.</p>'
                . '</body></html>';
        }
        exit;
    }

    return $pdo;
}
