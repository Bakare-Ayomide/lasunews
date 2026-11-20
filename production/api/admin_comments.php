<?php
/**
 * LASU Campus Broadcast - Admin Comments & Moderation API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = in_array($method, ['PATCH', 'DELETE'], true) ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

if ($method === 'GET') {
    $status = trim((string) ($_GET['status'] ?? 'all'));
    $conditions = ['1=1'];
    $params = [];
    if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
        $conditions[] = 'cm.status = ?';
        $params[] = $status;
    }
    $where = implode(' AND ', $conditions);
    $stmt = $pdo->prepare(
        "SELECT cm.*, a.title AS article_title, a.slug AS article_slug, u.department
         FROM comments cm
         INNER JOIN articles a ON a.id = cm.article_id
         LEFT JOIN users u ON u.id = cm.user_id
         WHERE {$where}
         ORDER BY CASE WHEN cm.status = 'pending' THEN 0 ELSE 1 END, cm.created_at DESC"
    );
    $stmt->execute($params);
    json_response(['comments' => $stmt->fetchAll()]);
}

if ($method === 'PATCH') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $status = trim((string) ($body['status'] ?? ''));
    if (!in_array($status, ['approved', 'rejected', 'pending'], true)) {
        json_response(['error' => 'Invalid moderation status.'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, author_name FROM comments WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Comment not found.'], 404);
    }

    $pdo->prepare('UPDATE comments SET status = ? WHERE id = ?')->execute([$status, $id]);
    log_activity($pdo, (int) $admin['id'], 'moderate_comment', 'comment', $id, 'Marked comment by ' . $existing['author_name'] . ' as ' . $status);
    json_response(['success' => true]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, author_name FROM comments WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Comment not found.'], 404);
    }

    $pdo->prepare('DELETE FROM comments WHERE id = ?')->execute([$id]);
    log_activity($pdo, (int) $admin['id'], 'delete_comment', 'comment', $id, 'Deleted comment by ' . $existing['author_name']);
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
