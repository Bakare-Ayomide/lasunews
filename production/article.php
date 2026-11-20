<?php
/**
 * LASU Campus Broadcast - Individual News Article Page with Comments & Sidebar Ad (MySQL PDO)
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$slug = trim((string) ($_GET['slug'] ?? ''));
$pdo = lasu_db();
$readerUser = current_user();

$stmt = $pdo->prepare(
    "SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color, ad.full_name AS author_name
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     INNER JOIN admins ad ON ad.id = a.author_id
     WHERE a.slug = ? AND a.status = 'published'
     LIMIT 1"
);
$stmt->execute([$slug]);
$article = $stmt->fetch();

if (!$article) {
    http_response_code(404);
    $pageTitle = 'Dispatch Not Found — LASU Campus Broadcast';
    require __DIR__ . '/includes/header.php';
    echo '<section class="section" style="border-bottom:none;"><div class="container"><div class="empty-box">'
        . '<h1>Dispatch Unavailable</h1>'
        . '<p>This broadcast does not exist or is currently in draft status.</p>'
        . '<a href="' . e(url_for('/news.php')) . '" class="btn btn-primary">Return to News Archive</a>'
        . '</div></div></section>';
    require __DIR__ . '/includes/footer.php';
    exit;
}

// Increment real DB view count
$pdo->prepare('UPDATE articles SET views = views + 1 WHERE id = ?')->execute([(int) $article['id']]);
$article['views'] = (int) $article['views'] + 1;

// Approved comments
$cStmt = $pdo->prepare(
    "SELECT cm.id, cm.author_name, cm.content, cm.created_at, u.department
     FROM comments cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.article_id = ? AND cm.status = 'approved'
     ORDER BY cm.created_at DESC"
);
$cStmt->execute([(int) $article['id']]);
$comments = $cStmt->fetchAll();

// Related articles
$relStmt = $pdo->prepare(
    "SELECT a.id, a.title, a.slug, a.excerpt, a.published_at, a.created_at,
            c.name AS category_name, c.color_hex AS category_color
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     WHERE a.status = 'published' AND a.id != ?
     ORDER BY CASE WHEN a.category_id = ? THEN 0 ELSE 1 END,
              COALESCE(a.published_at, a.created_at) DESC
     LIMIT 3"
);
$relStmt->execute([(int) $article['id'], (int) $article['category_id']]);
$related = $relStmt->fetchAll();

// Sidebar Ads + record impressions
$sidebarAds = fetch_active_ads($pdo, 'sidebar_box');
record_ad_impressions($pdo, $sidebarAds);

$rawContent = (string) ($article['content'] ?? '');
$isRichContent = is_rich_html($rawContent);
$sanitizedRichHtml = $isRichContent ? sanitize_article_html($rawContent) : '';
$paragraphs = $isRichContent
    ? []
    : array_values(array_filter(
        array_map('trim', preg_split('/\R{2,}/', $rawContent) ?: [])
    ));

$shareUrl = urlencode(full_url_for('/article.php?slug=' . urlencode((string) $article['slug'])));
$shareTitle = urlencode((string) $article['title']);

$pageTitle = $article['title'] . ' — LASU Campus Broadcast';
$pageDescription = (string) $article['excerpt'];
$activeNav = 'news';
require __DIR__ . '/includes/header.php';
?>

<article style="background:#FFFFFF;border-bottom:1px solid var(--lasu-border);">
  <div class="container">
    <div style="padding-top:2rem;">
      <a href="<?= e(url_for('/news.php')) ?>" style="font-size:0.78rem;font-weight:600;color:var(--lasu-muted);">
        &larr; Back to Campus News
      </a>
    </div>

    <div class="article-layout">
      <div>
        <header class="article-header">
          <div class="meta-line">
            <a href="<?= e(url_for('/news.php?category=' . urlencode((string) $article['category_slug']))) ?>"
               style="padding:0.2rem 0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#fff;background:<?= e($article['category_color'] ?: '#0B2545') ?>;">
              <?= e($article['category_name']) ?>
            </a>
            <?php if (!empty($article['is_announcement'])): ?>
              <span class="meta-urgent">
                <?= ($article['announcement_priority'] ?? 'normal') === 'urgent' ? 'Urgent Announcement' : 'Official Announcement' ?>
              </span>
            <?php endif; ?>
            <span>&middot;</span>
            <span><?= e(format_date($article['published_at'] ?? $article['created_at'])) ?></span>
            <span>&middot;</span>
            <span><?= e(estimate_read_time((string) $article['content'])) ?></span>
            <span>&middot;</span>
            <span class="font-mono tabular-nums"><?= (int) $article['views'] ?> reads</span>
          </div>

          <h1 class="article-headline"><?= e($article['title']) ?></h1>
          <p class="article-deck"><?= e($article['excerpt']) ?></p>

          <div class="share-bar">
            <p style="font-size:0.875rem;">By <strong><?= e($article['author_name']) ?></strong> &middot; LASU Editorial Desk</p>
            <div class="share-actions">
              <button type="button" id="copyArticleLinkBtn" class="share-btn">Copy Link</button>
              <a href="https://twitter.com/intent/tweet?text=<?= e($shareTitle) ?>&amp;url=<?= e($shareUrl) ?>" target="_blank" rel="noopener noreferrer" class="share-btn">Share on X</a>
              <a href="https://api.whatsapp.com/send?text=<?= e($shareTitle) ?>%20<?= e($shareUrl) ?>" target="_blank" rel="noopener noreferrer" class="share-btn">WhatsApp</a>
            </div>
          </div>
        </header>

        <?php if (!empty($article['featured_image'])): ?>
          <figure class="article-hero-figure">
            <img src="<?= e(media_url($article['featured_image'])) ?>" alt="<?= e($article['title']) ?>">
            <figcaption>LASU Campus Broadcast Archive &mdash; <?= e($article['category_name']) ?></figcaption>
          </figure>
        <?php endif; ?>

        <div class="article-prose">
          <?php if ($isRichContent): ?>
            <?= $sanitizedRichHtml ?>
          <?php else: ?>
            <?php foreach ($paragraphs as $para): ?>
              <p><?= nl2br(e($para)) ?></p>
            <?php endforeach; ?>
          <?php endif; ?>
        </div>

        <!-- Campus Discussion & Comment Moderation -->
        <section class="comments-section">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
            <h2 style="font-size:1.5rem;">Campus Discussion (<span class="tabular-nums"><?= count($comments) ?></span>)</h2>
            <?php if (!$readerUser): ?>
              <a href="<?= e(url_for('/account.php')) ?>" class="text-link">Sign in to Reader Account &rarr;</a>
            <?php endif; ?>
          </div>

          <form id="commentForm" data-article-slug="<?= e($article['slug']) ?>" class="form-card" style="background:var(--lasu-paper);margin-bottom:1.5rem;">
            <?php if ($readerUser): ?>
              <p style="font-size:0.8rem;margin-bottom:0.85rem;">
                Commenting as <strong><?= e($readerUser['full_name']) ?></strong> (<?= e($readerUser['email']) ?>)
              </p>
            <?php else: ?>
              <div class="form-grid-2">
                <div class="form-group">
                  <label for="commentAuthorName" class="form-label">Your Name</label>
                  <input id="commentAuthorName" name="author_name" type="text" required class="input" style="background:#fff;" placeholder="Full name">
                </div>
                <div class="form-group">
                  <label for="commentAuthorEmail" class="form-label">Email Address</label>
                  <input id="commentAuthorEmail" name="author_email" type="email" required class="input" style="background:#fff;" placeholder="name@lasu.edu.ng">
                </div>
              </div>
            <?php endif; ?>

            <div class="form-group">
              <label for="commentContent" class="form-label">Comment</label>
              <textarea id="commentContent" name="content" rows="3" required minlength="3" class="textarea" style="background:#fff;" placeholder="Share a constructive response (subject to editorial moderation)..."></textarea>
            </div>
            <div id="commentFeedback" class="alert" hidden></div>
            <button type="submit" class="btn btn-primary btn-sm">Post Comment</button>
          </form>

          <?php if (empty($comments)): ?>
            <p style="font-size:0.875rem;color:var(--lasu-muted);">
              No approved comments yet. Be the first member of the LASU community to respond.
            </p>
          <?php else: ?>
            <div style="border:1px solid var(--lasu-border-soft);background:#fff;">
              <?php foreach ($comments as $cm): ?>
                <div class="comment-card">
                  <div class="meta-line" style="margin-bottom:0.35rem;">
                    <strong style="color:var(--lasu-ink);"><?= e($cm['author_name']) ?></strong>
                    <?php if (!empty($cm['department'])): ?>
                      <span>&middot;</span>
                      <span><?= e($cm['department']) ?></span>
                    <?php endif; ?>
                    <span>&middot;</span>
                    <span class="font-mono"><?= e(format_datetime($cm['created_at'])) ?></span>
                  </div>
                  <p style="font-size:0.9rem;"><?= nl2br(e($cm['content'])) ?></p>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </section>
      </div>

      <aside>
        <?php if (!empty($sidebarAds)): ?>
          <div class="ad-slots-stack" style="margin-bottom:1.5rem;" data-ad-group="sidebar_box">
            <?php foreach ($sidebarAds as $sidebarAd):
              $expMs = ad_expires_at_ms($sidebarAd['expires_at'] ?? null);
            ?>
              <div class="ad-box" data-ad-slot="sidebar_box" <?= $expMs !== null ? 'data-ad-expires-ms="' . $expMs . '"' : '' ?>>
                <div class="ad-box-label">
                  <span>Sponsored Notice</span>
                  <span><?= e($sidebarAd['advertiser_name']) ?></span>
                </div>
                <a href="<?= !empty($sidebarAd['target_url']) ? e(url_for('/ad_click.php?id=' . (int) $sidebarAd['id'])) : '#' ?>"
                   <?= !empty($sidebarAd['target_url']) ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
                  <?php if (!empty($sidebarAd['image_url'])): ?>
                    <img src="<?= e(media_url($sidebarAd['image_url'])) ?>" alt="<?= e($sidebarAd['title']) ?>" class="media-4x3" style="width:100%;object-fit:cover;">
                  <?php else: ?>
                    <div style="padding:1.25rem;background:var(--lasu-navy);color:#fff;">
                      <div style="font-family:var(--font-serif);font-size:1.1rem;font-weight:700;"><?= e($sidebarAd['title']) ?></div>
                    </div>
                  <?php endif; ?>
                  <div style="padding:0.7rem 0.9rem;border-top:1px solid var(--lasu-border-soft);font-size:0.78rem;font-weight:600;">
                    <?= e($sidebarAd['title']) ?>
                  </div>
                </a>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>

        <?php if (!empty($related)): ?>
          <div class="sidebar-box">
            <div class="sidebar-box-head">
              <h3>Related Campus Stories</h3>
            </div>
            <div class="sidebar-box-body">
              <ul class="trending-list">
                <?php foreach ($related as $item): ?>
                  <li class="trending-item" style="display:block;">
                    <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;color:<?= e($item['category_color'] ?: '#0B2545') ?>;">
                      <?= e($item['category_name']) ?>
                    </div>
                    <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $item['slug']))) ?>" style="font-family:var(--font-serif);font-weight:700;font-size:0.95rem;display:block;margin-top:0.2rem;line-height:1.35;">
                      <?= e($item['title']) ?>
                    </a>
                  </li>
                <?php endforeach; ?>
              </ul>
            </div>
          </div>
        <?php endif; ?>
      </aside>
    </div>
  </div>
</article>

<?php require __DIR__ . '/includes/footer.php'; ?>
