<?php
/**
 * LASU Campus Broadcast - Categories CRUD API (with color_hex support)
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = in_array($method, ['POST', 'PUT', 'DELETE'], true) ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

if ($method === 'GET') {
    $categories = $pdo->query(
        "SELECT c.*, COUNT(a.id) AS article_count,
                SUM(CASE WHEN a.status = 'published' THEN 1 ELSE 0 END) AS published_count
         FROM categories c
         LEFT JOIN articles a ON a.category_id = c.id
         GROUP BY c.id
         ORDER BY c.id ASC"
    )->fetchAll();
    json_response(['categories' => $categories]);
}

if ($method === 'POST') {
    $name = trim((string) ($body['name'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $colorHex = sanitize_hex_color($body['color_hex'] ?? null);

    if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
        json_response(['error' => 'Category name must be 2–80 characters.'], 400);
    }

    $dup = $pdo->prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1');
    $dup->execute([$name]);
    if ($dup->fetch()) {
        json_response(['error' => 'A category with this name already exists.'], 409);
    }

    $slug = unique_category_slug($pdo, $name);
    $stmt = $pdo->prepare('INSERT INTO categories (name, slug, description, color_hex) VALUES (?, ?, ?, ?)');
    $stmt->execute([$name, $slug, mb_substr($description, 0, 255), $colorHex]);
    $newId = (int) $pdo->lastInsertId();

    log_activity($pdo, (int) $admin['id'], 'create', 'category', $newId, 'Created category "' . $name . '"');
    $cat = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
    $cat->execute([$newId]);
    json_response(['category' => $cat->fetch()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $name = trim((string) ($body['name'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $colorHex = sanitize_hex_color($body['color_hex'] ?? null);

    $exists = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $exists->execute([$id]);
    if (!$exists->fetch()) {
        json_response(['error' => 'Category not found.'], 404);
    }
    if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
        json_response(['error' => 'Category name must be 2–80 characters.'], 400);
    }

    $dup = $pdo->prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1');
    $dup->execute([$name, $id]);
    if ($dup->fetch()) {
        json_response(['error' => 'Another category already uses this name.'], 409);
    }

    $slug = unique_category_slug($pdo, $name, $id);
    $pdo->prepare('UPDATE categories SET name = ?, slug = ?, description = ?, color_hex = ? WHERE id = ?')
        ->execute([$name, $slug, mb_substr($description, 0, 255), $colorHex, $id]);

    log_activity($pdo, (int) $admin['id'], 'update', 'category', $id, 'Updated category "' . $name . '"');
    $cat = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
    $cat->execute([$id]);
    json_response(['category' => $cat->fetch()]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, name FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Category not found.'], 404);
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM articles WHERE category_id = ?');
    $countStmt->execute([$id]);
    $cnt = (int) ($countStmt->fetch()['cnt'] ?? 0);
    if ($cnt > 0) {
        json_response(['error' => 'Cannot delete "' . $existing['name'] . '" because ' . $cnt . ' article(s) belong to it.'], 409);
    }

    $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    log_activity($pdo, (int) $admin['id'], 'delete', 'category', $id, 'Deleted category "' . $existing['name'] . '"');
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
