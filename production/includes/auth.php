<?php
/**
 * LASU Campus Broadcast - Secure PHP Session, Admin & Public Reader Authentication
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $cfg = lasu_load_config();
    $lifetime = (int) ($cfg['session_lifetime'] ?? 43200);
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $isCrossSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')) === 'cross-site';

    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);

    session_name('LASU_BROADCAST_SID');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => app_base_path() !== '' ? app_base_path() : '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => ($isHttps && $isCrossSite) ? 'None' : 'Lax',
    ]);

    session_start();
}

function current_admin(): ?array
{
    start_secure_session();
    if (empty($_SESSION['admin_id'])) {
        return null;
    }

    $pdo = lasu_db();
    $stmt = $pdo->prepare('SELECT id, full_name, email, role, is_active FROM admins WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $_SESSION['admin_id']]);
    $admin = $stmt->fetch();

    if (!$admin || (int) $admin['is_active'] !== 1) {
        unset($_SESSION['admin_id']);
        return null;
    }

    return $admin;
}

function current_user(): ?array
{
    start_secure_session();
    if (empty($_SESSION['reader_user_id'])) {
        return null;
    }

    $pdo = lasu_db();
    $stmt = $pdo->prepare('SELECT id, full_name, email, department, is_active, created_at FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $_SESSION['reader_user_id']]);
    $user = $stmt->fetch();

    if (!$user || (int) $user['is_active'] !== 1) {
        unset($_SESSION['reader_user_id']);
        return null;
    }

    return $user;
}

function require_admin_page(): array
{
    $admin = current_admin();
    if (!$admin) {
        header('Location: ' . url_for('/admin/login.php'));
        exit;
    }
    return $admin;
}

function require_admin_api(array $body = []): array
{
    $admin = current_admin();
    if (!$admin) {
        json_response(['error' => 'Authentication required. Please sign in.'], 401);
    }

    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $token = request_csrf_token($body);
        if (!verify_csrf_token($token)) {
            json_response(['error' => 'Invalid or missing CSRF security token.'], 403);
        }
    }

    return $admin;
}

function require_super_admin_api(array $admin): void
{
    if (($admin['role'] ?? '') !== 'super_admin') {
        json_response(['error' => 'Super Administrator privileges are required for this action.'], 403);
    }
}

function attempt_admin_login(string $email, string $password): array
{
    start_secure_session();
    $pdo = lasu_db();

    $stmt = $pdo->prepare('SELECT id, full_name, email, password_hash, role, is_active FROM admins WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower(trim($email))]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, (string) $admin['password_hash'])) {
        return ['ok' => false, 'error' => 'Invalid email or password.'];
    }

    if ((int) $admin['is_active'] !== 1) {
        return ['ok' => false, 'error' => 'This administrator account has been deactivated.'];
    }

    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    $pdo->prepare('UPDATE admins SET last_login = NOW() WHERE id = ?')->execute([(int) $admin['id']]);
    log_activity($pdo, (int) $admin['id'], 'login', 'admin', (int) $admin['id'], 'Signed in to LASU Broadcast Console');

    return [
        'ok' => true,
        'admin' => [
            'id'        => (int) $admin['id'],
            'full_name' => $admin['full_name'],
            'email'     => $admin['email'],
            'role'      => $admin['role'],
        ],
        'csrfToken' => $_SESSION['csrf_token'],
    ];
}

function logout_admin(): void
{
    start_secure_session();
    if (!empty($_SESSION['admin_id'])) {
        try {
            $pdo = lasu_db();
            log_activity($pdo, (int) $_SESSION['admin_id'], 'logout', 'admin', (int) $_SESSION['admin_id'], 'Signed out');
        } catch (Throwable) {
            // Ignore logging error during logout
        }
    }

    unset($_SESSION['admin_id']);
    if (empty($_SESSION['reader_user_id'])) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
        }
        session_destroy();
    }
}

function register_public_user(string $fullName, string $email, string $password, string $department = ''): array
{
    start_secure_session();
    $pdo = lasu_db();

    $fullName = trim($fullName);
    $email = strtolower(trim($email));
    $department = trim($department);

    if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 100) {
        return ['ok' => false, 'error' => 'Full name must be between 2 and 100 characters.'];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Please enter a valid email address.'];
    }
    if (strlen($password) < 6) {
        return ['ok' => false, 'error' => 'Password must be at least 6 characters.'];
    }

    $dup = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $dup->execute([$email]);
    if ($dup->fetch()) {
        return ['ok' => false, 'error' => 'An account with this email already exists.'];
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare(
        'INSERT INTO users (full_name, email, password_hash, department, is_active, last_login) VALUES (?, ?, ?, ?, 1, NOW())'
    );
    $stmt->execute([$fullName, $email, $hash, mb_substr($department, 0, 120)]);
    $userId = (int) $pdo->lastInsertId();

    session_regenerate_id(true);
    $_SESSION['reader_user_id'] = $userId;
    csrf_token();

    return [
        'ok' => true,
        'user' => [
            'id'         => $userId,
            'full_name'  => $fullName,
            'email'      => $email,
            'department' => $department,
            'is_active'  => 1,
        ],
    ];
}

function attempt_user_login(string $email, string $password): array
{
    start_secure_session();
    $pdo = lasu_db();

    $stmt = $pdo->prepare('SELECT id, full_name, email, password_hash, department, is_active FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower(trim($email))]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        return ['ok' => false, 'error' => 'Invalid email or password.'];
    }

    if ((int) $user['is_active'] !== 1) {
        return ['ok' => false, 'error' => 'This reader account has been suspended by the editorial office.'];
    }

    session_regenerate_id(true);
    $_SESSION['reader_user_id'] = (int) $user['id'];
    csrf_token();

    $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([(int) $user['id']]);

    return [
        'ok' => true,
        'user' => [
            'id'         => (int) $user['id'],
            'full_name'  => $user['full_name'],
            'email'      => $user['email'],
            'department' => $user['department'],
            'is_active'  => 1,
        ],
    ];
}

function logout_user(): void
{
    start_secure_session();
    unset($_SESSION['reader_user_id']);
}
