<?php
/**
 * LASU Campus Broadcast - Public Comment Submission API (MySQL PDO)
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = get_json_body();
$pdo = lasu_db();

$slug = trim((string) ($body['slug'] ?? ''));
$content = trim((string) ($body['content'] ?? ''));

$artStmt = $pdo->prepare("SELECT id, title FROM articles WHERE slug = ? AND status = 'published' LIMIT 1");
$artStmt->execute([$slug]);
$article = $artStmt->fetch();
if (!$article) {
    json_response(['error' => 'Article not found.'], 404);
}

$reader = current_user();
$admin = current_admin();

$authorName = $reader ? (string) $reader['full_name'] : trim((string) ($body['author_name'] ?? ''));
$authorEmail = $reader ? (string) $reader['email'] : strtolower(trim((string) ($body['author_email'] ?? '')));

if ($admin && $authorName === '') {
    $authorName = (string) $admin['full_name'];
    $authorEmail = (string) $admin['email'];
}

if (mb_strlen($authorName) < 2 || mb_strlen($authorName) > 100) {
    json_response(['error' => 'Please enter your full name (2–100 characters).'], 400);
}
if (!filter_var($authorEmail, FILTER_VALIDATE_EMAIL)) {
    json_response(['error' => 'Please enter a valid email address.'], 400);
}
if (mb_strlen($content) < 3 || mb_strlen($content) > 1500) {
    json_response(['error' => 'Comment must be between 3 and 1,500 characters.'], 400);
}

$initialStatus = $admin ? 'approved' : 'pending';
$userId = $reader ? (int) $reader['id'] : null;

$stmt = $pdo->prepare(
    'INSERT INTO comments (article_id, user_id, author_name, author_email, content, status) VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    (int) $article['id'],
    $userId,
    $authorName,
    $authorEmail,
    $content,
    $initialStatus,
]);

json_response([
    'status' => $initialStatus,
    'message' => $initialStatus === 'approved'
        ? 'Your comment has been published.'
        : 'Thank you. Your comment has been submitted and is awaiting editorial moderation.',
], 201);
