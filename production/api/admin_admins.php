<?php
/**
 * LASU Campus Broadcast - Administrators Management API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = in_array($method, ['POST', 'PUT', 'DELETE'], true) ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

if ($method === 'GET') {
    $admins = $pdo->query(
        'SELECT a.id, a.full_name, a.email, a.role, a.is_active, a.last_login, a.created_at,
                COUNT(art.id) AS article_count
         FROM admins a
         LEFT JOIN articles art ON art.author_id = a.id
         GROUP BY a.id
         ORDER BY a.created_at ASC'
    )->fetchAll();
    json_response(['admins' => $admins]);
}

require_super_admin_api($admin);

if ($method === 'POST') {
    $fullName = trim((string) ($body['full_name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $role = ($body['role'] ?? 'editor') === 'super_admin' ? 'super_admin' : 'editor';

    if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 100) {
        json_response(['error' => 'Full name must be 2–100 characters.'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Please provide a valid email address.'], 400);
    }
    if (strlen($password) < 8) {
        json_response(['error' => 'Password must be at least 8 characters long.'], 400);
    }

    $dup = $pdo->prepare('SELECT id FROM admins WHERE email = ? LIMIT 1');
    $dup->execute([$email]);
    if ($dup->fetch()) {
        json_response(['error' => 'An administrator account with this email already exists.'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO admins (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)');
    $stmt->execute([$fullName, $email, $hash, $role]);
    $newId = (int) $pdo->lastInsertId();

    log_activity($pdo, (int) $admin['id'], 'create', 'admin', $newId, 'Created ' . $role . ' account for ' . $email);
    $created = $pdo->prepare('SELECT id, full_name, email, role, is_active, last_login, created_at FROM admins WHERE id = ?');
    $created->execute([$newId]);
    json_response(['admin' => $created->fetch()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, email FROM admins WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Administrator account not found.'], 404);
    }

    $fullName = trim((string) ($body['full_name'] ?? ''));
    $role = ($body['role'] ?? 'editor') === 'super_admin' ? 'super_admin' : 'editor';
    $isActive = !empty($body['is_active']) ? 1 : 0;
    $password = (string) ($body['password'] ?? '');

    if ($id === (int) $admin['id'] && $isActive === 0) {
        json_response(['error' => 'You cannot deactivate your own active account.'], 400);
    }
    if (mb_strlen($fullName) < 2) {
        json_response(['error' => 'Full name must be at least 2 characters.'], 400);
    }
    if ($password !== '' && strlen($password) < 8) {
        json_response(['error' => 'New password must be at least 8 characters.'], 400);
    }

    if ($password !== '') {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $pdo->prepare('UPDATE admins SET full_name = ?, role = ?, is_active = ?, password_hash = ? WHERE id = ?')
            ->execute([$fullName, $role, $isActive, $hash, $id]);
    } else {
        $pdo->prepare('UPDATE admins SET full_name = ?, role = ?, is_active = ? WHERE id = ?')
            ->execute([$fullName, $role, $isActive, $id]);
    }

    log_activity($pdo, (int) $admin['id'], 'update', 'admin', $id, 'Updated administrator ' . $existing['email']);
    $updated = $pdo->prepare('SELECT id, full_name, email, role, is_active, last_login, created_at FROM admins WHERE id = ?');
    $updated->execute([$id]);
    json_response(['admin' => $updated->fetch()]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if ($id === (int) $admin['id']) {
        json_response(['error' => 'You cannot delete your own account while signed in.'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, email FROM admins WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Administrator account not found.'], 404);
    }

    $artStmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM articles WHERE author_id = ?');
    $artStmt->execute([$id]);
    $cnt = (int) ($artStmt->fetch()['cnt'] ?? 0);
    if ($cnt > 0) {
        json_response(['error' => 'Cannot delete ' . $existing['email'] . ' because they authored ' . $cnt . ' article(s). Deactivate instead.'], 409);
    }

    $pdo->prepare('DELETE FROM admins WHERE id = ?')->execute([$id]);
    log_activity($pdo, (int) $admin['id'], 'delete', 'admin', $id, 'Removed administrator ' . $existing['email']);
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
