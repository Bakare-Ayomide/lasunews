<?php
/**
 * LASU Campus Broadcast - Articles & Announcements CRUD API
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
    $categoryId = trim((string) ($_GET['category_id'] ?? 'all'));
    $type = trim((string) ($_GET['type'] ?? 'all'));

    $conditions = ['1=1'];
    $params = [];

    if ($q !== '') {
        $conditions[] = '(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }
    if ($status === 'published' || $status === 'draft') {
        $conditions[] = 'a.status = ?';
        $params[] = $status;
    }
    if ($categoryId !== 'all' && ctype_digit($categoryId)) {
        $conditions[] = 'a.category_id = ?';
        $params[] = (int) $categoryId;
    }
    if ($type === 'announcement') {
        $conditions[] = 'a.is_announcement = 1';
    } elseif ($type === 'featured') {
        $conditions[] = 'a.is_featured = 1';
    } elseif ($type === 'breaking') {
        $conditions[] = 'a.is_breaking = 1';
    } elseif ($type === 'news') {
        $conditions[] = 'a.is_announcement = 0';
    }

    $where = implode(' AND ', $conditions);
    $stmt = $pdo->prepare(
        "SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE {$where}
         ORDER BY a.updated_at DESC, a.id DESC"
    );
    $stmt->execute($params);
    json_response(['articles' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $title = trim((string) ($body['title'] ?? ''));
    $excerpt = trim((string) ($body['excerpt'] ?? ''));
    $content = trim((string) ($body['content'] ?? ''));
    $featuredImage = trim((string) ($body['featured_image'] ?? ''));
    $categoryId = (int) ($body['category_id'] ?? 0);
    $status = ($body['status'] ?? 'draft') === 'published' ? 'published' : 'draft';
    $isFeatured = !empty($body['is_featured']) ? 1 : 0;
    $isBreaking = !empty($body['is_breaking']) ? 1 : 0;
    $isAnnouncement = !empty($body['is_announcement']) ? 1 : 0;
    $priority = ($body['announcement_priority'] ?? 'normal') === 'urgent' ? 'urgent' : 'normal';

    if (mb_strlen($title) < 5 || mb_strlen($title) > 220) {
        json_response(['error' => 'Article headline must be between 5 and 220 characters.'], 400);
    }
    if (mb_strlen($excerpt) < 10 || mb_strlen($excerpt) > 500) {
        json_response(['error' => 'Summary/excerpt must be between 10 and 500 characters.'], 400);
    }
    if (mb_strlen($content) < 20) {
        json_response(['error' => 'Article body content must be at least 20 characters.'], 400);
    }

    $catStmt = $pdo->prepare('SELECT id, name FROM categories WHERE id = ? LIMIT 1');
    $catStmt->execute([$categoryId]);
    $cat = $catStmt->fetch();
    if (!$cat) {
        json_response(['error' => 'Please select a valid news category.'], 400);
    }

    $slug = unique_article_slug($pdo, $title);
    $publishedAt = $status === 'published' ? date('Y-m-d H:i:s') : null;

    $insert = $pdo->prepare(
        'INSERT INTO articles (
           title, slug, excerpt, content, featured_image, category_id, author_id,
           status, is_featured, is_breaking, is_announcement, announcement_priority, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([
        $title,
        $slug,
        $excerpt,
        $content,
        $featuredImage,
        $categoryId,
        (int) $admin['id'],
        $status,
        $isFeatured,
        $isBreaking,
        $isAnnouncement,
        $priority,
        $publishedAt,
    ]);

    $newId = (int) $pdo->lastInsertId();
    log_activity(
        $pdo,
        (int) $admin['id'],
        $status === 'published' ? 'publish' : 'create_draft',
        'article',
        $newId,
        ($status === 'published' ? 'Published' : 'Saved draft') . ' "' . $title . '" in ' . $cat['name']
    );

    $fetch = $pdo->prepare(
        'SELECT a.*, c.name AS category_name, c.color_hex AS category_color, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.id = ?'
    );
    $fetch->execute([$newId]);
    json_response(['article' => $fetch->fetch()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM articles WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Article not found.'], 404);
    }

    $title = trim((string) ($body['title'] ?? ''));
    $excerpt = trim((string) ($body['excerpt'] ?? ''));
    $content = trim((string) ($body['content'] ?? ''));
    $featuredImage = trim((string) ($body['featured_image'] ?? ''));
    $categoryId = (int) ($body['category_id'] ?? 0);
    $status = ($body['status'] ?? 'draft') === 'published' ? 'published' : 'draft';
    $isFeatured = !empty($body['is_featured']) ? 1 : 0;
    $isBreaking = !empty($body['is_breaking']) ? 1 : 0;
    $isAnnouncement = !empty($body['is_announcement']) ? 1 : 0;
    $priority = ($body['announcement_priority'] ?? 'normal') === 'urgent' ? 'urgent' : 'normal';

    if (mb_strlen($title) < 5 || mb_strlen($title) > 220) {
        json_response(['error' => 'Article headline must be between 5 and 220 characters.'], 400);
    }
    if (mb_strlen($excerpt) < 10 || mb_strlen($excerpt) > 500) {
        json_response(['error' => 'Summary/excerpt must be between 10 and 500 characters.'], 400);
    }
    if (mb_strlen($content) < 20) {
        json_response(['error' => 'Article body content must be at least 20 characters.'], 400);
    }

    $catStmt = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $catStmt->execute([$categoryId]);
    if (!$catStmt->fetch()) {
        json_response(['error' => 'Please select a valid news category.'], 400);
    }

    $slug = unique_article_slug($pdo, $title, $id);
    $publishedAt = $existing['published_at'];
    if ($status === 'published' && !$publishedAt) {
        $publishedAt = date('Y-m-d H:i:s');
    }

    $update = $pdo->prepare(
        'UPDATE articles SET
           title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?,
           category_id = ?, status = ?, is_featured = ?, is_breaking = ?, is_announcement = ?,
           announcement_priority = ?, published_at = ?
         WHERE id = ?'
    );
    $update->execute([
        $title,
        $slug,
        $excerpt,
        $content,
        $featuredImage,
        $categoryId,
        $status,
        $isFeatured,
        $isBreaking,
        $isAnnouncement,
        $priority,
        $publishedAt,
        $id,
    ]);

    $verb = 'update';
    if ($existing['status'] !== 'published' && $status === 'published') {
        $verb = 'publish';
    } elseif ($existing['status'] === 'published' && $status === 'draft') {
        $verb = 'unpublish';
    }
    log_activity($pdo, (int) $admin['id'], $verb, 'article', $id, 'Updated "' . $title . '" (' . $status . ')');

    $fetch = $pdo->prepare(
        'SELECT a.*, c.name AS category_name, c.color_hex AS category_color, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.id = ?'
    );
    $fetch->execute([$id]);
    json_response(['article' => $fetch->fetch()]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, title, featured_image FROM articles WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Article not found.'], 404);
    }

    $pdo->prepare('DELETE FROM articles WHERE id = ?')->execute([$id]);

    $img = (string) ($existing['featured_image'] ?? '');
    if ($img !== '' && str_contains($img, '/uploads/articles/')) {
        $checkStmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM articles WHERE featured_image = ?');
        $checkStmt->execute([$img]);
        if ((int) ($checkStmt->fetch()['cnt'] ?? 0) === 0) {
            $basename = basename($img);
            $filePath = dirname(__DIR__) . '/uploads/articles/' . $basename;
            if (is_file($filePath)) {
                @unlink($filePath);
            }
        }
    }

    log_activity($pdo, (int) $admin['id'], 'delete', 'article', $id, 'Deleted article "' . $existing['title'] . '"');
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
