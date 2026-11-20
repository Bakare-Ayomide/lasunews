<?php
/**
 * LASU Campus Broadcast - Official Announcements Bulletin Page
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = lasu_db();
$q = trim((string) ($_GET['q'] ?? ''));

$conditions = ["a.status = 'published'", "a.is_announcement = 1"];
$params = [];
if ($q !== '') {
    $conditions[] = '(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like);
}

$where = implode(' AND ', $conditions);
$stmt = $pdo->prepare(
    "SELECT a.id, a.title, a.slug, a.excerpt, a.announcement_priority,
            a.views, a.published_at, a.created_at,
            c.name AS category_name, ad.full_name AS author_name
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     INNER JOIN admins ad ON ad.id = a.author_id
     WHERE {$where}
     ORDER BY CASE WHEN a.announcement_priority = 'urgent' THEN 0 ELSE 1 END,
              COALESCE(a.published_at, a.created_at) DESC"
);
$stmt->execute($params);
$announcements = $stmt->fetchAll();

$pageTitle = 'Official Announcements — LASU Campus Broadcast';
$activeNav = 'announcements';
require __DIR__ . '/includes/header.php';
?>

<section class="section" style="border-bottom:none;">
  <div class="container">
    <div class="section-head" style="border-bottom:1px solid var(--lasu-border);padding-bottom:1.25rem;">
      <div>
        <p class="kicker">Official University Bulletins</p>
        <h1 class="section-title" style="font-size:2.25rem;">Campus Announcements &amp; Circulars</h1>
      </div>
      <span class="font-mono tabular-nums" style="font-size:0.8rem;color:var(--lasu-muted);">
        <?= count($announcements) ?> active
      </span>
    </div>

    <form method="get" action="<?= e(url_for('/announcements.php')) ?>" style="display:flex;gap:0.5rem;max-width:480px;margin-bottom:2rem;">
      <input type="search" name="q" value="<?= e($q) ?>" class="input" placeholder="Search official notices and circulars...">
      <button type="submit" class="btn btn-primary">Search</button>
    </form>

    <?php if (empty($announcements)): ?>
      <div class="empty-box">
        <h3>No active announcements published</h3>
        <p>Urgent circulars, academic notices, and Registrar announcements published by administrators will appear here.</p>
        <a href="<?= e(url_for('/admin/login.php')) ?>" class="btn btn-primary btn-sm">Admin Portal</a>
      </div>
    <?php else: ?>
      <div class="grid-3">
        <?php foreach ($announcements as $item): ?>
          <article class="card">
            <div class="card-body">
              <div>
                <div class="meta-line" style="margin-bottom:0.5rem;">
                  <?php if (($item['announcement_priority'] ?? 'normal') === 'urgent'): ?>
                    <span class="meta-urgent">Urgent Circular</span>
                  <?php else: ?>
                    <span class="meta-cat">Official Notice</span>
                  <?php endif; ?>
                  <span>&middot;</span>
                  <span><?= e(format_date($item['published_at'] ?? $item['created_at'])) ?></span>
                </div>
                <h2 class="card-title">
                  <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $item['slug']))) ?>">
                    <?= e($item['title']) ?>
                  </a>
                </h2>
                <p class="card-excerpt" style="margin-top:0.5rem;"><?= e($item['excerpt']) ?></p>
              </div>
              <div class="card-footer">
                <span><?= e($item['author_name']) ?></span>
                <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $item['slug']))) ?>" class="text-link">Read Circular &rarr;</a>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
