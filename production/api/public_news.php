<?php
/**
 * LASU Campus Broadcast - Public News Query API (MySQL PDO)
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$pdo = lasu_db();

$q = trim((string) ($_GET['q'] ?? ''));
$category = trim((string) ($_GET['category'] ?? ''));
$type = trim((string) ($_GET['type'] ?? 'all'));
$sort = trim((string) ($_GET['sort'] ?? 'latest'));
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(24, max(1, (int) ($_GET['limit'] ?? 9)));
$offset = ($page - 1) * $limit;

$conditions = ["a.status = 'published'"];
$params = [];

if ($q !== '') {
    $conditions[] = '(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ? OR c.name LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like, $like);
}

if ($category !== '' && $category !== 'all') {
    $conditions[] = 'c.slug = ?';
    $params[] = $category;
}

if ($type === 'announcement') {
    $conditions[] = 'a.is_announcement = 1';
} elseif ($type === 'featured') {
    $conditions[] = 'a.is_featured = 1';
} elseif ($type === 'breaking') {
    $conditions[] = 'a.is_breaking = 1';
}

$where = implode(' AND ', $conditions);
$order = $sort === 'trending'
    ? 'a.views DESC, COALESCE(a.published_at, a.created_at) DESC'
    : 'COALESCE(a.published_at, a.created_at) DESC';

$countStmt = $pdo->prepare(
    "SELECT COUNT(*) AS total FROM articles a INNER JOIN categories c ON c.id = a.category_id WHERE {$where}"
);
$countStmt->execute($params);
$total = (int) ($countStmt->fetch()['total'] ?? 0);

$sql = "SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
               a.is_featured, a.is_breaking, a.is_announcement, a.announcement_priority,
               a.views, a.published_at, a.created_at,
               c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
               ad.full_name AS author_name
        FROM articles a
        INNER JOIN categories c ON c.id = a.category_id
        INNER JOIN admins ad ON ad.id = a.author_id
        WHERE {$where}
        ORDER BY {$order}
        LIMIT ? OFFSET ?";

$stmt = $pdo->prepare($sql);
$bindIndex = 1;
foreach ($params as $val) {
    $stmt->bindValue($bindIndex++, $val, PDO::PARAM_STR);
}
$stmt->bindValue($bindIndex++, $limit, PDO::PARAM_INT);
$stmt->bindValue($bindIndex, $offset, PDO::PARAM_INT);
$stmt->execute();
$articles = $stmt->fetchAll();

$categories = [];
if (($_GET['include_categories'] ?? '') === '1') {
    $categories = $pdo->query('SELECT id, name, slug, description, color_hex FROM categories ORDER BY id ASC')->fetchAll();
}

$response = [
    'articles' => $articles,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'total_pages' => max(1, (int) ceil($total / $limit)),
    ],
];
if (!empty($categories)) {
    $response['categories'] = $categories;
}

json_response($response);
