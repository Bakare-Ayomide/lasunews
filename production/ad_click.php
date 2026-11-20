<?php
/**
 * LASU Campus Broadcast - Advertisement Click Tracking & Redirect
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/helpers.php';

$id = (int) ($_GET['id'] ?? 0);
$pdo = lasu_db();

$stmt = $pdo->prepare("SELECT id, target_url FROM advertisements WHERE id = ? AND status = 'active' LIMIT 1");
$stmt->execute([$id]);
$ad = $stmt->fetch();

if (!$ad) {
    header('Location: ' . url_for('/index.php'));
    exit;
}

$pdo->prepare('UPDATE advertisements SET clicks = clicks + 1 WHERE id = ?')->execute([$id]);

$target = trim((string) ($ad['target_url'] ?? ''));
if ($target !== '' && preg_match('/^https?:\/\//i', $target) === 1) {
    header('Location: ' . $target);
    exit;
}

header('Location: ' . url_for('/index.php'));
exit;
