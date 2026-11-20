<?php
/**
 * LASU Campus Broadcast - Contact Inquiries Management API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = $method === 'PATCH' ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

if ($method === 'GET') {
    $messages = $pdo->query('SELECT * FROM contact_messages ORDER BY is_read ASC, created_at DESC LIMIT 100')->fetchAll();
    json_response(['messages' => $messages]);
}

if ($method === 'PATCH') {
    $id = (int) ($body['id'] ?? 0);
    $isRead = !empty($body['is_read']) ? 1 : 0;
    $stmt = $pdo->prepare('SELECT id FROM contact_messages WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        json_response(['error' => 'Message not found.'], 404);
    }
    $pdo->prepare('UPDATE contact_messages SET is_read = ? WHERE id = ?')->execute([$isRead, $id]);
    log_activity($pdo, (int) $admin['id'], 'update', 'contact_message', $id, 'Marked message #' . $id . ' as ' . ($isRead ? 'read' : 'unread'));
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
