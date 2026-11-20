<?php
/**
 * LASU Campus Broadcast - Public Landing Page (MySQL PDO, MIT News Broadsheet Style)
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = lasu_db();
$readerUser = current_user();

$baseSelect = "
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
           a.is_featured, a.is_breaking, a.is_announcement, a.announcement_priority,
           a.views, a.published_at, a.created_at,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
           ad.full_name AS author_name
    FROM articles a
    INNER JOIN categories c ON c.id = a.category_id
    INNER JOIN admins ad ON ad.id = a.author_id
    WHERE a.status = 'published'
";

$featured = $pdo->query("{$baseSelect} AND a.is_featured = 1 ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 5")->fetchAll();
$latest = $pdo->query("{$baseSelect} ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 8")->fetchAll();
$breaking = $pdo->query(
    "{$baseSelect} AND (a.is_breaking = 1 OR (a.is_announcement = 1 AND a.announcement_priority = 'urgent'))
     ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 6"
)->fetchAll();
$trending = $pdo->query("{$baseSelect} ORDER BY a.views DESC, COALESCE(a.published_at, a.created_at) DESC LIMIT 5")->fetchAll();
$announcements = $pdo->query(
    "{$baseSelect} AND a.is_announcement = 1
     ORDER BY CASE WHEN a.announcement_priority = 'urgent' THEN 0 ELSE 1 END,
              COALESCE(a.published_at, a.created_at) DESC
     LIMIT 6"
)->fetchAll();

$categories = $pdo->query(
    "SELECT c.id, c.name, c.slug, c.description, c.color_hex,
            SUM(CASE WHEN a.status = 'published' THEN 1 ELSE 0 END) AS published_count
     FROM categories c
     LEFT JOIN articles a ON a.category_id = c.id
     GROUP BY c.id
     ORDER BY c.id ASC"
)->fetchAll();

// Colorful category columns (up to 3 articles per category desk)
$categorySections = [];
$catArticleStmt = $pdo->prepare(
    "{$baseSelect} AND a.category_id = ? ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 3"
);
foreach ($categories as $cat) {
    $catArticleStmt->execute([(int) $cat['id']]);
    $categorySections[] = [
        'category' => $cat,
        'articles' => $catArticleStmt->fetchAll(),
    ];
}

// Active non-expired Advertisements + real impression tracking
$activeAds = fetch_active_ads($pdo);
record_ad_impressions($pdo, $activeAds);

$topAds = [];
$inlineAds = [];
$sidebarAds = [];
foreach ($activeAds as $ad) {
    if ($ad['placement'] === 'top_banner') $topAds[] = $ad;
    if ($ad['placement'] === 'inline_banner') $inlineAds[] = $ad;
    if ($ad['placement'] === 'sidebar_box') $sidebarAds[] = $ad;
}

$statsRow = $pdo->query(
    "SELECT
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS total_published,
       SUM(CASE WHEN status = 'published' AND is_announcement = 1 THEN 1 ELSE 0 END) AS total_announcements,
       COALESCE(SUM(CASE WHEN status = 'published' THEN views ELSE 0 END), 0) AS total_views
     FROM articles"
)->fetch();

$approvedCommentsCount = (int) ($pdo->query("SELECT COUNT(*) AS cnt FROM comments WHERE status = 'approved'")->fetch()['cnt'] ?? 0);
$totalPublished = (int) ($statsRow['total_published'] ?? 0);
$totalAnnouncements = (int) ($statsRow['total_announcements'] ?? 0);
$totalViews = (int) ($statsRow['total_views'] ?? 0);

$featuredLead = $featured[0] ?? ($latest[0] ?? null);
$featuredGridItems = count($featured) > 1 ? array_slice($featured, 1, 4) : array_slice($latest, 1, 4);

$pageTitle = 'LASU News — Lagos State University Campus Broadcasting System';
$activeNav = 'home';
$footerCategories = $categories;
require __DIR__ . '/includes/header.php';
?>

<!-- MIT News Style Masthead + Boxed Toolbar + Breaking Ticker -->
<section class="masthead-band">
  <div class="container masthead-inner">
    <div class="masthead-brand-lockup">
      <img src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png" alt="Lagos State University" class="masthead-logo">
      <div class="masthead-title-wrap">
        <h1 class="masthead-title">LASU News</h1>
        <p class="masthead-sub">On Campus and Around Lagos State University</p>
      </div>
    </div>

    <div class="masthead-toolbar">
      <div class="masthead-cell">
        <a href="<?= e(url_for('/account.php')) ?>" class="masthead-btn">
          <span><?= $readerUser ? e($readerUser['full_name']) : 'Reader Account' ?></span>
        </a>
      </div>

      <div class="masthead-cell">
        <button type="button" id="browseDesksBtn" class="masthead-btn" aria-haspopup="true">
          <span>Browse Desks</span>
          <span>&#9662;</span>
        </button>
        <div id="browseDesksMenu" class="browse-menu" hidden>
          <?php foreach ($categories as $cat): ?>
            <a href="<?= e(url_for('/news.php?category=' . urlencode((string) $cat['slug']))) ?>">
              <span style="display:flex;align-items:center;gap:0.5rem;">
                <span class="swatch-dot" style="background:<?= e($cat['color_hex'] ?: '#0B2545') ?>;"></span>
                <?= e($cat['name']) ?>
              </span>
              <span class="font-mono tabular-nums" style="color:var(--lasu-muted);"><?= (int) ($cat['published_count'] ?? 0) ?></span>
            </a>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="masthead-cell">
        <form action="<?= e(url_for('/news.php')) ?>" method="get" class="masthead-search">
          <input type="search" name="q" placeholder="SEARCH NEWS" aria-label="Search LASU News">
          <button type="submit" aria-label="Submit Search">&#128269;</button>
        </form>
      </div>
    </div>
  </div>

  <!-- Breaking-News Ticker -->
  <div class="ticker-bar">
    <div class="container ticker-inner">
      <div class="ticker-left">
        <span class="breaking-tag">Breaking</span>
        <?php if (empty($breaking)): ?>
          <span class="ticker-headline" style="color:#CBD5E1;">
            LASU News Desk: No active breaking dispatches right now — browse official university desks below.
          </span>
        <?php else: ?>
          <?php foreach ($breaking as $bIdx => $bItem): ?>
            <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $bItem['slug']))) ?>"
               class="ticker-headline"
               data-ticker-item
               <?= $bIdx > 0 ? 'hidden' : '' ?>>
              <span style="color:var(--lasu-gold-soft);font-weight:700;margin-right:0.35rem;">[<?= e($bItem['category_name']) ?>]</span>
              <?= e($bItem['title']) ?>
            </a>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>

      <?php if (count($breaking) > 1): ?>
        <div class="ticker-controls">
          <button type="button" id="tickerPrevBtn" class="ticker-nav-btn" aria-label="Previous breaking news">&lsaquo;</button>
          <span id="tickerCounter" class="font-mono tabular-nums" style="font-size:0.72rem;color:#CBD5E1;">1/<?= count($breaking) ?></span>
          <button type="button" id="tickerNextBtn" class="ticker-nav-btn" aria-label="Next breaking news">&rsaquo;</button>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- Split-Box Dark Hero -->
<section class="hero-band">
  <div class="container">
    <div class="hero-split-box">
      <div class="hero-photo">
        <?php if ($featuredLead && !empty($featuredLead['featured_image'])): ?>
          <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $featuredLead['slug']))) ?>" style="display:block;height:100%;">
            <img src="<?= e(media_url($featuredLead['featured_image'])) ?>" alt="<?= e($featuredLead['title']) ?>">
          </a>
        <?php else: ?>
          <img src="<?= e(url_for('/assets/images/lasu-campus-hero.jpg')) ?>" alt="Lagos State University Senate Building">
        <?php endif; ?>
      </div>

      <div class="hero-dark-panel">
        <?php if ($featuredLead): ?>
          <div>
            <div style="display:flex;align-items:center;gap:0.65rem;font-size:0.75rem;">
              <span class="hero-cat-pill" style="background:<?= e($featuredLead['category_color'] ?: '#B8860B') ?>;">
                <?= e($featuredLead['category_name']) ?>
              </span>
              <span style="color:#CBD5E1;"><?= e(format_date($featuredLead['published_at'] ?? $featuredLead['created_at'])) ?></span>
            </div>
            <h2 class="hero-headline"><?= e($featuredLead['title']) ?></h2>
            <p class="hero-deck"><?= e($featuredLead['excerpt']) ?></p>
          </div>
          <div class="hero-dark-footer">
            <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $featuredLead['slug']))) ?>" style="color:var(--lasu-gold-soft);font-size:0.875rem;font-weight:600;">
              Read Full Story &rarr;
            </a>
            <span class="font-mono tabular-nums" style="font-size:0.75rem;color:#CBD5E1;">
              <?= $totalPublished ?> Published
            </span>
          </div>
        <?php else: ?>
          <div>
            <span class="hero-cat-pill" style="background:var(--lasu-gold);">Official Newsroom</span>
            <h2 class="hero-headline">Verified Campus Journalism &amp; University Broadcasts</h2>
            <p class="hero-deck">
              No news dispatches have been published to the MySQL database yet. University editors can sign in to publish featured headlines, breaking news, and category reports.
            </p>
          </div>
          <div class="hero-dark-footer">
            <?php if ($loggedAdmin): ?>
              <a href="<?= e(url_for('/admin/index.php')) ?>" class="btn btn-sm" style="background:var(--lasu-gold);color:#fff;">
                Publish First Broadcast &rarr;
              </a>
            <?php else: ?>
              <a href="<?= e(url_for('/news.php')) ?>" class="btn btn-sm" style="background:var(--lasu-gold);color:#fff;">
                Browse News Archive &rarr;
              </a>
            <?php endif; ?>
            <span class="font-mono tabular-nums" style="font-size:0.75rem;color:#CBD5E1;">0 Published</span>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<!-- Today's Featured News: Vertical Rail + 2x2 Boxed Horizontal Grid -->
<section class="featured-rail-band">
  <div class="container">
    <div class="rail-layout">
      <div class="rail-margin">
        <h2 class="vertical-rail-label">Today&apos;s Featured News</h2>
      </div>

      <div class="rail-grid-wrap">
        <?php if (empty($featuredGridItems)): ?>
          <div class="empty-box" style="text-align:left;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;">
            <div>
              <h3>Featured Story Slots Ready</h3>
              <p style="margin:0;">Featured campus stories selected by the editorial desk will appear in this 2&times;2 broadsheet grid.</p>
            </div>
            <?php if ($loggedAdmin): ?>
              <a href="<?= e(url_for('/admin/index.php')) ?>" class="btn btn-primary btn-sm">Open Editor</a>
            <?php endif; ?>
          </div>
        <?php else: ?>
          <div class="featured-2x2">
            <?php foreach ($featuredGridItems as $art): ?>
              <article class="horiz-story-card">
                <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>" class="media-4x3">
                  <?php if (!empty($art['featured_image'])): ?>
                    <img src="<?= e(media_url($art['featured_image'])) ?>" alt="<?= e($art['title']) ?>">
                  <?php else: ?>
                    <div class="media-fallback"><?= e($art['category_name']) ?></div>
                  <?php endif; ?>
                </a>
                <div class="horiz-story-body">
                  <div>
                    <div class="meta-line" style="margin-bottom:0.35rem;">
                      <span class="meta-cat" style="color:<?= e($art['category_color'] ?: '#0B2545') ?>;"><?= e($art['category_name']) ?></span>
                      <span>&middot;</span>
                      <span><?= e(format_date($art['published_at'] ?? $art['created_at'])) ?></span>
                    </div>
                    <h3 class="card-title" style="font-size:0.98rem;">
                      <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>">
                        <?= e($art['title']) ?>
                      </a>
                    </h3>
                    <p class="card-excerpt" style="font-size:0.78rem;margin-top:0.35rem;"><?= e($art['excerpt']) ?></p>
                  </div>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<!-- Top Leaderboard Advertisement Slots -->
<?php if (!empty($topAds)): ?>
<div class="container" style="padding-top:2rem;" data-ad-group="top_banner">
  <div class="ad-slots-grid">
    <?php foreach ($topAds as $topAd):
      $expMs = ad_expires_at_ms($topAd['expires_at'] ?? null);
    ?>
      <div class="ad-box" data-ad-slot="top_banner" <?= $expMs !== null ? 'data-ad-expires-ms="' . $expMs . '"' : '' ?>>
        <div class="ad-box-label">
          <span>Campus Advertisement</span>
          <span><?= e($topAd['advertiser_name']) ?></span>
        </div>
        <a href="<?= !empty($topAd['target_url']) ? e(url_for('/ad_click.php?id=' . (int) $topAd['id'])) : '#' ?>"
           <?= !empty($topAd['target_url']) ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
          <?php if (!empty($topAd['image_url'])): ?>
            <img src="<?= e(media_url($topAd['image_url'])) ?>" alt="<?= e($topAd['title']) ?>" style="width:100%;max-height:140px;object-fit:cover;">
          <?php else: ?>
            <div style="padding:1rem 1.5rem;background:var(--lasu-navy);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:1rem;">
              <div>
                <div style="font-size:0.72rem;text-transform:uppercase;color:var(--lasu-gold-soft);"><?= e($topAd['advertiser_name']) ?></div>
                <div style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;"><?= e($topAd['title']) ?></div>
              </div>
              <?php if (!empty($topAd['target_url'])): ?>
                <span class="btn btn-sm" style="background:var(--lasu-gold);color:#fff;">Visit Link &rarr;</span>
              <?php endif; ?>
            </div>
          <?php endif; ?>
        </a>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<!-- Colorful Category-Based News Columns & Rows -->
<section class="section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="kicker">Campus Editorial Desks</p>
        <h2 class="section-title">News by Category</h2>
      </div>
      <a href="<?= e(url_for('/news.php')) ?>" class="text-link">View All Categories &rarr;</a>
    </div>

    <div class="cat-columns-grid">
      <?php foreach ($categorySections as $section):
        $cat = $section['category'];
        $catArts = $section['articles'];
        $deskColor = $cat['color_hex'] ?: '#0B2545';
      ?>
        <div class="cat-box">
          <div class="cat-box-header" style="background:<?= e($deskColor) ?>;">
            <h3><?= e($cat['name']) ?></h3>
            <a href="<?= e(url_for('/news.php?category=' . urlencode((string) $cat['slug']))) ?>" style="font-size:0.72rem;font-weight:600;">
              More &rarr;
            </a>
          </div>
          <div class="cat-box-list">
            <?php if (empty($catArts)): ?>
              <p style="padding:1.5rem 0;text-align:center;font-size:0.8rem;color:var(--lasu-muted);">
                No stories published in <?= e($cat['name']) ?> yet.
              </p>
            <?php else: ?>
              <?php foreach ($catArts as $cIdx => $cArt): ?>
                <article class="cat-box-item">
                  <?php if ($cIdx === 0 && !empty($cArt['featured_image'])): ?>
                    <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $cArt['slug']))) ?>" class="media-16x9" style="display:block;margin-bottom:0.6rem;">
                      <img src="<?= e(media_url($cArt['featured_image'])) ?>" alt="<?= e($cArt['title']) ?>">
                    </a>
                  <?php endif; ?>
                  <h4 style="font-size:0.95rem;font-weight:700;line-height:1.35;">
                    <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $cArt['slug']))) ?>">
                      <?= e($cArt['title']) ?>
                    </a>
                  </h4>
                  <p style="font-size:0.78rem;color:var(--lasu-muted);margin-top:0.25rem;"><?= e($cArt['excerpt']) ?></p>
                  <p class="font-mono tabular-nums" style="font-size:0.7rem;color:var(--lasu-muted);margin-top:0.35rem;">
                    <?= e(format_date($cArt['published_at'] ?? $cArt['created_at'])) ?> &middot; <?= (int) $cArt['views'] ?> reads
                  </p>
                </article>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Latest Wire + Boxed Sidebar (Announcements, Trending, Sidebar Ad) -->
<section class="section">
  <div class="container">
    <div class="broadsheet-grid">
      <div>
        <div class="section-head" style="margin-bottom:1rem;">
          <div>
            <p class="kicker">Live Wire</p>
            <h2 class="section-title">Latest Campus Dispatches</h2>
          </div>
          <a href="<?= e(url_for('/news.php')) ?>" class="text-link">Full Archive &rarr;</a>
        </div>

        <div class="category-tabs" role="tablist">
          <button type="button" class="tab-btn is-active" role="tab" aria-selected="true" data-category-tab="all" data-category-color="#0B2545">All Desks</button>
          <?php foreach ($categories as $cat): ?>
            <button type="button" class="tab-btn" role="tab" aria-selected="false"
                    data-category-tab="<?= e($cat['slug']) ?>"
                    data-category-color="<?= e($cat['color_hex'] ?: '#0B2545') ?>">
              <?= e($cat['name']) ?>
            </button>
          <?php endforeach; ?>
        </div>

        <div id="latestBroadcastsContainer">
          <?php if (empty($latest)): ?>
            <div class="empty-box">
              <h3>No published broadcasts in this feed yet</h3>
              <p>Campus dispatches and official bulletins will appear here as soon as they are published.</p>
              <?php if ($loggedAdmin): ?>
                <a href="<?= e(url_for('/admin/index.php')) ?>" class="btn btn-primary btn-sm">Admin Portal</a>
              <?php endif; ?>
            </div>
          <?php else: ?>
            <div class="story-list">
              <?php foreach ($latest as $art): ?>
                <article class="story-row">
                  <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>" class="media-4x3" style="border:1px solid var(--lasu-border-soft);">
                    <?php if (!empty($art['featured_image'])): ?>
                      <img src="<?= e(media_url($art['featured_image'])) ?>" alt="<?= e($art['title']) ?>">
                    <?php else: ?>
                      <div class="media-fallback"><?= e($art['category_name']) ?></div>
                    <?php endif; ?>
                  </a>
                  <div>
                    <div class="meta-line">
                      <span class="meta-cat" style="color:<?= e($art['category_color'] ?: '#0B2545') ?>;"><?= e($art['category_name']) ?></span>
                      <span>&middot;</span>
                      <span><?= e(format_date($art['published_at'] ?? $art['created_at'])) ?></span>
                      <span>&middot;</span>
                      <span><?= e(estimate_read_time($art['excerpt'])) ?></span>
                    </div>
                    <h3 class="card-title" style="margin:0.4rem 0;">
                      <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>">
                        <?= e($art['title']) ?>
                      </a>
                    </h3>
                    <p class="card-excerpt"><?= e($art['excerpt']) ?></p>
                    <div class="card-footer" style="border-top:none;padding-top:0.5rem;">
                      <span>By <?= e($art['author_name']) ?></span>
                      <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $art['slug']))) ?>" class="text-link">Read Story &rarr;</a>
                    </div>
                  </div>
                </article>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>

        <!-- Inline Advertisement Slots -->
        <?php if (!empty($inlineAds)): ?>
          <div class="ad-slots-stack" style="margin-top:1.75rem;" data-ad-group="inline_banner">
            <?php foreach ($inlineAds as $inlineAd):
              $expMs = ad_expires_at_ms($inlineAd['expires_at'] ?? null);
            ?>
              <div class="ad-box" data-ad-slot="inline_banner" <?= $expMs !== null ? 'data-ad-expires-ms="' . $expMs . '"' : '' ?>>
                <div class="ad-box-label">
                  <span>Campus Advertisement</span>
                  <span><?= e($inlineAd['advertiser_name']) ?></span>
                </div>
                <a href="<?= !empty($inlineAd['target_url']) ? e(url_for('/ad_click.php?id=' . (int) $inlineAd['id'])) : '#' ?>"
                   <?= !empty($inlineAd['target_url']) ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
                  <?php if (!empty($inlineAd['image_url'])): ?>
                    <img src="<?= e(media_url($inlineAd['image_url'])) ?>" alt="<?= e($inlineAd['title']) ?>" style="width:100%;max-height:140px;object-fit:cover;">
                  <?php else: ?>
                    <div style="padding:1rem 1.5rem;background:var(--lasu-navy);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:1rem;">
                      <div>
                        <div style="font-size:0.72rem;text-transform:uppercase;color:var(--lasu-gold-soft);"><?= e($inlineAd['advertiser_name']) ?></div>
                        <div style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;"><?= e($inlineAd['title']) ?></div>
                      </div>
                      <?php if (!empty($inlineAd['target_url'])): ?>
                        <span class="btn btn-sm" style="background:var(--lasu-gold);color:#fff;">Visit Link &rarr;</span>
                      <?php endif; ?>
                    </div>
                  <?php endif; ?>
                </a>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <aside>
        <!-- Official Announcements Box -->
        <div class="sidebar-box">
          <div class="sidebar-box-head is-crimson">
            <h3>Official Announcements</h3>
            <a href="<?= e(url_for('/announcements.php')) ?>" style="font-size:0.72rem;font-weight:600;">All &rarr;</a>
          </div>
          <div class="sidebar-box-body">
            <?php if (empty($announcements)): ?>
              <p style="font-size:0.8rem;color:var(--lasu-muted);">No active Senate or Registrar announcements published yet.</p>
            <?php else: ?>
              <ul class="trending-list">
                <?php foreach (array_slice($announcements, 0, 4) as $item): ?>
                  <li class="trending-item" style="display:block;">
                    <div style="font-size:0.7rem;margin-bottom:0.2rem;">
                      <span class="<?= ($item['announcement_priority'] ?? 'normal') === 'urgent' ? 'meta-urgent' : 'meta-cat' ?>">
                        <?= ($item['announcement_priority'] ?? 'normal') === 'urgent' ? 'Urgent Circular' : 'Notice' ?>
                      </span>
                      <span style="color:var(--lasu-muted);margin:0 0.25rem;">&middot;</span>
                      <span style="color:var(--lasu-muted);"><?= e(format_date($item['published_at'] ?? $item['created_at'])) ?></span>
                    </div>
                    <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $item['slug']))) ?>" style="font-family:var(--font-serif);font-weight:700;font-size:0.92rem;line-height:1.35;">
                      <?= e($item['title']) ?>
                    </a>
                  </li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </div>
        </div>

        <!-- Trending Box -->
        <div class="sidebar-box">
          <div class="sidebar-box-head">
            <h3>Most Read on Campus</h3>
          </div>
          <div class="sidebar-box-body">
            <?php if (empty($trending)): ?>
              <p style="font-size:0.8rem;color:var(--lasu-muted);">
                Most-read campus stories will populate here automatically as students read published articles.
              </p>
            <?php else: ?>
              <ol class="trending-list">
                <?php foreach ($trending as $idx => $item): ?>
                  <li class="trending-item">
                    <span class="trending-num tabular-nums"><?= str_pad((string) ($idx + 1), 2, '0', STR_PAD_LEFT) ?></span>
                    <div>
                      <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $item['slug']))) ?>" style="font-family:var(--font-serif);font-weight:700;font-size:0.92rem;display:block;line-height:1.35;">
                        <?= e($item['title']) ?>
                      </a>
                      <span class="font-mono tabular-nums" style="font-size:0.7rem;color:var(--lasu-muted);">
                        <?= e($item['category_name']) ?> &middot; <?= (int) $item['views'] ?> reads
                      </span>
                    </div>
                  </li>
                <?php endforeach; ?>
              </ol>
            <?php endif; ?>
          </div>
        </div>

        <!-- Sidebar Advertisement Boxes -->
        <?php if (!empty($sidebarAds)): ?>
          <div class="ad-slots-stack" style="margin-bottom:1.5rem;" data-ad-group="sidebar_box" data-ad-fallback-target="homeSidebarAdFallback">
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
                      <div style="font-size:0.75rem;color:var(--lasu-gold-soft);margin-top:0.35rem;">Learn more &rarr;</div>
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
        <div id="homeSidebarAdFallback" class="ad-fallback-slot" <?= !empty($sidebarAds) ? 'hidden' : '' ?>>
          <p style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--lasu-muted);">Campus Advertisement Space</p>
          <p style="font-size:0.78rem;color:var(--lasu-muted);margin:0.4rem 0 0.7rem;">Sponsored campus notices and departmental campaigns appear here.</p>
          <?php if ($loggedAdmin): ?>
            <a href="<?= e(url_for('/admin/index.php')) ?>" class="text-link">Manage Ads</a>
          <?php endif; ?>
        </div>
      </aside>
    </div>
  </div>
</section>

<!-- About Section -->
<section id="about" class="section section-white">
  <div class="container">
    <div class="about-grid">
      <div>
        <p class="kicker" style="color:#0F766E;">About the Directorate</p>
        <h2 class="section-title" style="margin-top:0.4rem;">Lagos State University Campus News &amp; Broadcasting Center</h2>
        <p class="card-excerpt" style="margin-top:0.85rem;font-size:0.95rem;">
          Unifying institutional reporting across Ojo Main Campus, Epe Engineering Campus, and Ikeja
          College of Medicine with verified dispatches, academic circulars, student discussions, and university bulletins.
        </p>
        <div class="about-kpi-row">
          <div>
            <p style="font-size:0.75rem;color:var(--lasu-muted);">Articles</p>
            <p class="font-serif tabular-nums" style="font-size:1.35rem;font-weight:700;"><?= $totalPublished ?></p>
          </div>
          <div>
            <p style="font-size:0.75rem;color:var(--lasu-muted);">Bulletins</p>
            <p class="font-serif tabular-nums" style="font-size:1.35rem;font-weight:700;"><?= $totalAnnouncements ?></p>
          </div>
          <div>
            <p style="font-size:0.75rem;color:var(--lasu-muted);">Comments</p>
            <p class="font-serif tabular-nums" style="font-size:1.35rem;font-weight:700;"><?= $approvedCommentsCount ?></p>
          </div>
          <div>
            <p style="font-size:0.75rem;color:var(--lasu-muted);">Total Reads</p>
            <p class="font-serif tabular-nums" style="font-size:1.35rem;font-weight:700;"><?= number_format($totalViews) ?></p>
          </div>
        </div>
      </div>

      <div class="about-photos">
        <div class="media-4x3">
          <img src="<?= e(url_for('/assets/images/lasu-broadcast-newsroom.jpg')) ?>" alt="LASU Campus Broadcasting Newsroom Editors">
        </div>
        <div class="media-4x3">
          <img src="<?= e(url_for('/assets/images/lasu-library-quad.jpg')) ?>" alt="Lagos State University Library Courtyard">
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Contact Section -->
<section id="contact" class="section">
  <div class="container">
    <div class="contact-grid">
      <div>
        <p class="kicker" style="color:var(--lasu-gold);">Press &amp; Inquiries</p>
        <h2 class="section-title" style="margin-top:0.4rem;">Contact the Campus Newsroom</h2>
        <p class="card-excerpt" style="margin-top:0.75rem;">
          Submit faculty press releases, student union event notices, or advertisement inquiries directly to
          the Directorate of Information &amp; Public Relations.
        </p>
        <div style="margin-top:1.25rem;font-size:0.875rem;display:grid;gap:0.6rem;">
          <p><strong>Address:</strong> Senate Building Annex, Lagos State University, Km 15 Badagry Expressway, Ojo, Lagos</p>
          <p><strong>Email:</strong> broadcast@lasu.edu.ng</p>
          <p><strong>Telephone:</strong> <span class="font-mono">+234 (0) 1 454 8199</span></p>
        </div>
      </div>

      <div class="form-card">
        <form id="contactForm">
          <div class="form-grid-2">
            <div class="form-group">
              <label for="senderName" class="form-label">Full Name</label>
              <input id="senderName" name="sender_name" type="text" required class="input" placeholder="e.g., Adewale Ogunleye">
            </div>
            <div class="form-group">
              <label for="senderEmail" class="form-label">Email Address</label>
              <input id="senderEmail" name="sender_email" type="email" required class="input" placeholder="name@lasu.edu.ng">
            </div>
          </div>
          <div class="form-group">
            <label for="contactSubject" class="form-label">Subject / Department</label>
            <input id="contactSubject" name="subject" type="text" required class="input" placeholder="Faculty event announcement or press inquiry">
          </div>
          <div class="form-group">
            <label for="contactMessage" class="form-label">Message</label>
            <textarea id="contactMessage" name="message" rows="4" required class="textarea" placeholder="Provide full details, dates, and contact information..."></textarea>
          </div>
          <div id="contactFeedback" class="alert" hidden></div>
          <button type="submit" class="btn btn-primary">Submit to Newsroom</button>
        </form>
      </div>
    </div>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
