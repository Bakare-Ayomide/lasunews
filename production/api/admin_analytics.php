<?php
/**
 * LASU Campus Broadcast - Full News Statistics & Performance Analytics API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_api();
$pdo = lasu_db();

$articleSummary = $pdo->query(
    "SELECT
       COUNT(*) AS total_articles,
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_articles,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_articles,
       SUM(CASE WHEN is_featured = 1 AND status = 'published' THEN 1 ELSE 0 END) AS featured_articles,
       SUM(CASE WHEN is_breaking = 1 AND status = 'published' THEN 1 ELSE 0 END) AS breaking_articles,
       SUM(CASE WHEN is_announcement = 1 AND status = 'published' THEN 1 ELSE 0 END) AS announcement_articles,
       COALESCE(SUM(views), 0) AS total_views,
       COALESCE(ROUND(AVG(CASE WHEN status = 'published' THEN views END), 1), 0) AS avg_views_published,
       COALESCE(MAX(views), 0) AS top_article_views
     FROM articles"
)->fetch();

$commentSummary = $pdo->query(
    "SELECT
       COUNT(*) AS total_comments,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_comments,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_comments,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_comments
     FROM comments"
)->fetch();

$adSummary = $pdo->query(
    "SELECT
       COUNT(*) AS total_ads,
       COALESCE(SUM(impressions), 0) AS total_impressions,
       COALESCE(SUM(clicks), 0) AS total_clicks
     FROM advertisements"
)->fetch();

$categoryBreakdown = $pdo->query(
    "SELECT c.id, c.name, c.slug, c.color_hex,
            COUNT(a.id) AS total_articles,
            SUM(CASE WHEN a.status = 'published' THEN 1 ELSE 0 END) AS published_articles,
            COALESCE(SUM(a.views), 0) AS total_views,
            COALESCE(ROUND(AVG(CASE WHEN a.status = 'published' THEN a.views END), 1), 0) AS avg_views,
            (SELECT COUNT(*) FROM comments cm
             INNER JOIN articles a2 ON a2.id = cm.article_id
             WHERE a2.category_id = c.id) AS comment_count
     FROM categories c
     LEFT JOIN articles a ON a.category_id = c.id
     GROUP BY c.id
     ORDER BY total_views DESC, c.name ASC"
)->fetchAll();

$articlePerformance = $pdo->query(
    "SELECT a.id, a.title, a.slug, a.status, a.views, a.is_featured, a.is_breaking,
            a.is_announcement, a.announcement_priority, a.published_at, a.created_at,
            c.id AS category_id, c.name AS category_name, c.color_hex AS category_color,
            ad.full_name AS author_name,
            COUNT(cm.id) AS total_comments,
            SUM(CASE WHEN cm.status = 'approved' THEN 1 ELSE 0 END) AS approved_comments
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     INNER JOIN admins ad ON ad.id = a.author_id
     LEFT JOIN comments cm ON cm.article_id = a.id
     GROUP BY a.id
     ORDER BY a.views DESC, COALESCE(a.published_at, a.created_at) DESC"
)->fetchAll();

json_response([
    'summary' => [
        'total_articles'        => (int) ($articleSummary['total_articles'] ?? 0),
        'published_articles'    => (int) ($articleSummary['published_articles'] ?? 0),
        'draft_articles'        => (int) ($articleSummary['draft_articles'] ?? 0),
        'featured_articles'     => (int) ($articleSummary['featured_articles'] ?? 0),
        'breaking_articles'     => (int) ($articleSummary['breaking_articles'] ?? 0),
        'announcement_articles' => (int) ($articleSummary['announcement_articles'] ?? 0),
        'total_views'           => (int) ($articleSummary['total_views'] ?? 0),
        'avg_views_published'   => (float) ($articleSummary['avg_views_published'] ?? 0),
        'top_article_views'     => (int) ($articleSummary['top_article_views'] ?? 0),
        'total_comments'        => (int) ($commentSummary['total_comments'] ?? 0),
        'approved_comments'     => (int) ($commentSummary['approved_comments'] ?? 0),
        'pending_comments'      => (int) ($commentSummary['pending_comments'] ?? 0),
        'rejected_comments'     => (int) ($commentSummary['rejected_comments'] ?? 0),
        'total_ads'             => (int) ($adSummary['total_ads'] ?? 0),
        'total_impressions'     => (int) ($adSummary['total_impressions'] ?? 0),
        'total_clicks'          => (int) ($adSummary['total_clicks'] ?? 0),
    ],
    'categoryBreakdown'  => $categoryBreakdown,
    'articlePerformance' => $articlePerformance,
]);
