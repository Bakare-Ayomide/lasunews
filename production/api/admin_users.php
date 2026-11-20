<?php
/**
 * LASU Campus Broadcast - Admin Reader User Accounts Full CRUD API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

if ($method === 'GET') {
    $q = trim((string) ($_GET['q'] ?? ''));
    $status = trim((string) ($_GET['status'] ?? 'all'));

    $conditions = ['1=1'];
    $params = [];

    if ($q !== '') {
        $conditions[] = '(u.full_name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }
    if ($status === 'active') {
        $conditions[] = 'u.is_active = 1';
    } elseif ($status === 'suspended') {
        $conditions[] = 'u.is_active = 0';
    }

    $where = implode(' AND ', $conditions);
    $stmt = $pdo->prepare(
        "SELECT u.id, u.full_name, u.email, u.department, u.is_active, u.last_login, u.created_at,
                COUNT(cm.id) AS comment_count
         FROM users u
         LEFT JOIN comments cm ON cm.user_id = u.id
         WHERE {$where}
         GROUP BY u.id
         ORDER BY u.created_at DESC"
    );
    $stmt->execute($params);
    json_response(['users' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $fullName = trim((string) ($body['full_name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $department = trim((string) ($body['department'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $isActive = (!isset($body['is_active']) || !empty($body['is_active'])) ? 1 : 0;

    if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 100) {
        json_response(['error' => 'Full name must be between 2 and 100 characters.'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Please enter a valid email address.'], 400);
    }
    if (strlen($password) < 6) {
        json_response(['error' => 'Password must be at least 6 characters.'], 400);
    }

    $dup = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $dup->execute([$email]);
    if ($dup->fetch()) {
        json_response(['error' => 'A reader account with this email already exists.'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO users (full_name, email, password_hash, department, is_active) VALUES (?, ?, ?, ?, ?)'
    );
    $insert->execute([$fullName, $email, $hash, mb_substr($department, 0, 120), $isActive]);
    $newId = (int) $pdo->lastInsertId();

    log_activity($pdo, (int) $admin['id'], 'create_user', 'user', $newId, 'Created reader account ' . $email);

    $fetch = $pdo->prepare('SELECT id, full_name, email, department, is_active, last_login, created_at FROM users WHERE id = ?');
    $fetch->execute([$newId]);
    json_response(['user' => $fetch->fetch()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Reader account not found.'], 404);
    }

    $fullName = trim((string) ($body['full_name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $department = trim((string) ($body['department'] ?? ''));
    $newPassword = (string) ($body['password'] ?? '');
    $isActive = (!isset($body['is_active']) || !empty($body['is_active'])) ? 1 : 0;

    if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 100) {
        json_response(['error' => 'Full name must be between 2 and 100 characters.'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Please enter a valid email address.'], 400);
    }
    if ($newPassword !== '' && strlen($newPassword) < 6) {
        json_response(['error' => 'New password must be at least 6 characters.'], 400);
    }

    $dup = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
    $dup->execute([$email, $id]);
    if ($dup->fetch()) {
        json_response(['error' => 'Another reader account already uses this email.'], 409);
    }

    if ($newPassword !== '') {
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $pdo->prepare(
            'UPDATE users SET full_name = ?, email = ?, department = ?, password_hash = ?, is_active = ? WHERE id = ?'
        )->execute([$fullName, $email, mb_substr($department, 0, 120), $hash, $isActive, $id]);
    } else {
        $pdo->prepare(
            'UPDATE users SET full_name = ?, email = ?, department = ?, is_active = ? WHERE id = ?'
        )->execute([$fullName, $email, mb_substr($department, 0, 120), $isActive, $id]);
    }

    log_activity($pdo, (int) $admin['id'], 'update_user', 'user', $id, 'Updated reader account ' . $email);

    $fetch = $pdo->prepare('SELECT id, full_name, email, department, is_active, last_login, created_at FROM users WHERE id = ?');
    $fetch->execute([$id]);
    json_response(['user' => $fetch->fetch()]);
}

if ($method === 'PATCH') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $isActive = !empty($body['is_active']) ? 1 : 0;

    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Reader account not found.'], 404);
    }

    $pdo->prepare('UPDATE users SET is_active = ? WHERE id = ?')->execute([$isActive, $id]);
    log_activity($pdo, (int) $admin['id'], 'update_user', 'user', $id, ($isActive ? 'Activated' : 'Suspended') . ' reader ' . $existing['email']);
    json_response(['success' => true]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Reader account not found.'], 404);
    }

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    log_activity($pdo, (int) $admin['id'], 'delete_user', 'user', $id, 'Removed reader ' . $existing['email']);
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
