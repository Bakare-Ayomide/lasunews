<?php
/**
 * LASU Campus Broadcast - Admin Overview & Activity API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_api();
$pdo = lasu_db();

$stats = $pdo->query(
    "SELECT
       COUNT(*) AS total_articles,
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_articles,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_articles,
       SUM(CASE WHEN is_announcement = 1 THEN 1 ELSE 0 END) AS total_announcements,
       SUM(CASE WHEN is_featured = 1 AND status = 'published' THEN 1 ELSE 0 END) AS featured_articles,
       SUM(CASE WHEN is_breaking = 1 AND status = 'published' THEN 1 ELSE 0 END) AS breaking_articles,
       COALESCE(SUM(views), 0) AS total_views
     FROM articles"
)->fetch();

$catCount = (int) ($pdo->query('SELECT COUNT(*) AS cnt FROM categories')->fetch()['cnt'] ?? 0);
$adminCount = (int) ($pdo->query('SELECT COUNT(*) AS cnt FROM admins WHERE is_active = 1')->fetch()['cnt'] ?? 0);
$userCount = (int) ($pdo->query('SELECT COUNT(*) AS cnt FROM users')->fetch()['cnt'] ?? 0);
$pendingComments = (int) ($pdo->query("SELECT COUNT(*) AS cnt FROM comments WHERE status = 'pending'")->fetch()['cnt'] ?? 0);
$activeAdsStmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM advertisements WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?)");
$activeAdsStmt->execute([date('Y-m-d H:i:s')]);
$activeAds = (int) ($activeAdsStmt->fetch()['cnt'] ?? 0);
$unreadCount = (int) ($pdo->query('SELECT COUNT(*) AS cnt FROM contact_messages WHERE is_read = 0')->fetch()['cnt'] ?? 0);

$recentArticles = $pdo->query(
    "SELECT a.id, a.title, a.slug, a.status, a.is_featured, a.is_breaking, a.is_announcement,
            a.views, a.published_at, a.updated_at,
            c.name AS category_name, c.color_hex AS category_color, ad.full_name AS author_name
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     INNER JOIN admins ad ON ad.id = a.author_id
     ORDER BY a.updated_at DESC, a.id DESC
     LIMIT 8"
)->fetchAll();

$recentActivity = $pdo->query(
    "SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
            COALESCE(a.full_name, 'System') AS admin_name
     FROM activity_logs l
     LEFT JOIN admins a ON a.id = l.admin_id
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT 50"
)->fetchAll();

json_response([
    'stats' => [
        'total_articles'      => (int) ($stats['total_articles'] ?? 0),
        'published_articles'  => (int) ($stats['published_articles'] ?? 0),
        'draft_articles'      => (int) ($stats['draft_articles'] ?? 0),
        'total_announcements' => (int) ($stats['total_announcements'] ?? 0),
        'featured_articles'   => (int) ($stats['featured_articles'] ?? 0),
        'breaking_articles'   => (int) ($stats['breaking_articles'] ?? 0),
        'total_views'         => (int) ($stats['total_views'] ?? 0),
        'total_categories'    => $catCount,
        'active_admins'       => $adminCount,
        'total_users'         => $userCount,
        'pending_comments'    => $pendingComments,
        'active_ads'          => $activeAds,
        'unread_messages'     => $unreadCount,
    ],
    'recentArticles' => $recentArticles,
    'recentActivity' => $recentActivity,
]);
