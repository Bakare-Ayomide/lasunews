<?php
/**
 * LASU Campus Broadcast - News Archive & Search Page (MySQL PDO)
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = lasu_db();

$q = trim((string) ($_GET['q'] ?? ''));
$categorySlug = trim((string) ($_GET['category'] ?? 'all'));
$sort = ($_GET['sort'] ?? 'latest') === 'trending' ? 'trending' : 'latest';
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = 9;
$offset = ($page - 1) * $limit;

$categories = $pdo->query('SELECT id, name, slug FROM categories ORDER BY name ASC')->fetchAll();

$conditions = ["a.status = 'published'"];
$params = [];

if ($q !== '') {
    $conditions[] = '(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ? OR c.name LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like, $like);
}
if ($categorySlug !== '' && $categorySlug !== 'all') {
    $conditions[] = 'c.slug = ?';
    $params[] = $categorySlug;
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
$totalPages = max(1, (int) ceil($total / $limit));

$stmt = $pdo->prepare(
    "SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
            a.views, a.published_at, a.created_at,
            c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
            ad.full_name AS author_name
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     INNER JOIN admins ad ON ad.id = a.author_id
     WHERE {$where}
     ORDER BY {$order}
     LIMIT ? OFFSET ?"
);
$idx = 1;
foreach ($params as $val) {
    $stmt->bindValue($idx++, $val, PDO::PARAM_STR);
}
$stmt->bindValue($idx++, $limit, PDO::PARAM_INT);
$stmt->bindValue($idx, $offset, PDO::PARAM_INT);
$stmt->execute();
$articles = $stmt->fetchAll();

$pageTitle = 'Campus News Archive — LASU Campus Broadcast';
$activeNav = 'news';
$footerCategories = $categories;
require __DIR__ . '/includes/header.php';
?>

<section class="section" style="border-bottom:none;">
  <div class="container">
    <div class="section-head" style="border-bottom:1px solid var(--lasu-border);padding-bottom:1.25rem;">
      <div>
        <p class="kicker">Lagos State University News Archive</p>
        <h1 class="section-title" style="font-size:2.25rem;">Campus News &amp; Dispatches</h1>
      </div>
      <span class="font-mono tabular-nums" style="font-size:0.8rem;color:var(--lasu-muted);">
        <?= $total ?> <?= $total === 1 ? 'story' : 'stories' ?> found
      </span>
    </div>

    <form method="get" action="<?= e(url_for('/news.php')) ?>" class="filter-bar">
      <input type="search" name="q" value="<?= e($q) ?>" class="input" placeholder="Search by headline, keyword, or faculty...">
      <select name="category" class="select" aria-label="Filter by category">
        <option value="all">All Categories</option>
        <?php foreach ($categories as $cat): ?>
          <option value="<?= e($cat['slug']) ?>" <?= $categorySlug === $cat['slug'] ? 'selected' : '' ?>>
            <?= e($cat['name']) ?>
          </option>
        <?php endforeach; ?>
      </select>
      <select name="sort" class="select" aria-label="Sort articles">
        <option value="latest" <?= $sort === 'latest' ? 'selected' : '' ?>>Latest First</option>
        <option value="trending" <?= $sort === 'trending' ? 'selected' : '' ?>>Most Read</option>
      </select>
      <button type="submit" class="btn btn-primary">Filter</button>
    </form>

    <?php if (empty($articles)): ?>
      <div class="empty-box">
        <h3>No matching broadcasts found</h3>
        <p>
          <?= ($q !== '' || $categorySlug !== 'all')
              ? 'No published stories match your current search or category filter.'
              : 'No articles have been published to the MySQL database yet.' ?>
        </p>
        <div style="display:flex;justify-content:center;gap:0.75rem;flex-wrap:wrap;">
          <?php if ($q !== '' || $categorySlug !== 'all'): ?>
            <a href="<?= e(url_for('/news.php')) ?>" class="btn btn-outline btn-sm">Reset Filters</a>
          <?php endif; ?>
          <?php if ($loggedAdmin): ?>
            <a href="<?= e(url_for('/admin/index.php')) ?>" class="btn btn-primary btn-sm">Admin Portal</a>
          <?php endif; ?>
        </div>
      </div>
    <?php else: ?>
      <div class="grid-3">
        <?php foreach ($articles as $art): ?>
          <article class="card">
            <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>" class="media-4x3">
              <?php if (!empty($art['featured_image'])): ?>
                <img src="<?= e(media_url($art['featured_image'])) ?>" alt="<?= e($art['title']) ?>">
              <?php else: ?>
                <div class="media-fallback"><?= e($art['category_name']) ?></div>
              <?php endif; ?>
            </a>
            <div class="card-body">
              <div>
                <div class="meta-line" style="margin-bottom:0.5rem;">
                  <span class="meta-cat" style="color:<?= e($art['category_color'] ?: '#0B2545') ?>;"><?= e($art['category_name']) ?></span>
                  <span>&middot;</span>
                  <span><?= e(format_date($art['published_at'] ?? $art['created_at'])) ?></span>
                </div>
                <h2 class="card-title">
                  <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>">
                    <?= e($art['title']) ?>
                  </a>
                </h2>
                <p class="card-excerpt" style="margin-top:0.5rem;"><?= e($art['excerpt']) ?></p>
              </div>
              <div class="card-footer">
                <span><?= e($art['author_name']) ?></span>
                <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>" class="text-link">Read &rarr;</a>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <?php if ($totalPages > 1): ?>
        <div class="pagination">
          <?php if ($page > 1): ?>
            <a href="<?= e(url_for('/news.php?' . http_build_query(['q' => $q, 'category' => $categorySlug, 'sort' => $sort, 'page' => $page - 1]))) ?>" class="btn btn-outline btn-sm">Previous</a>
          <?php else: ?>
            <span></span>
          <?php endif; ?>
          <span class="font-mono tabular-nums" style="font-size:0.8rem;color:var(--lasu-muted);">Page <?= $page ?> of <?= $totalPages ?></span>
          <?php if ($page < $totalPages): ?>
            <a href="<?= e(url_for('/news.php?' . http_build_query(['q' => $q, 'category' => $categorySlug, 'sort' => $sort, 'page' => $page + 1]))) ?>" class="btn btn-outline btn-sm">Next</a>
          <?php else: ?>
            <span></span>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
