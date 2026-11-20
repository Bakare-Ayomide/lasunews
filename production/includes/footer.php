<?php
/**
 * LASU Campus Broadcast - Public Site Footer Template
 */
declare(strict_types=1);

$footerCategories = $footerCategories ?? [];
if (empty($footerCategories)) {
    try {
        $pdo = lasu_db();
        $footerCategories = $pdo->query('SELECT id, name, slug FROM categories ORDER BY id ASC')->fetchAll();
    } catch (Throwable) {
        $footerCategories = [];
    }
}
?>
  </main>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div style="display:inline-block;background:#FFFFFF;padding:0.4rem 0.75rem;border-radius:3px;margin-bottom:0.85rem;">
            <img src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png" alt="Lagos State University" style="height:2.2rem;width:auto;object-fit:contain;">
          </div>
          <h2 class="footer-title">LASU Campus Broadcast</h2>
          <p class="footer-copy">
            The official digital newsroom and campus broadcasting bulletin of Lagos State University.
            Delivering verified institutional dispatches, academic notices, and student journalism across
            Ojo, Epe, and Ikeja campuses.
          </p>
          <p class="footer-address">Km 15, Badagry Expressway, Ojo, PMB 0001, Lagos, Nigeria</p>
        </div>

        <div class="footer-col">
          <h3 class="footer-heading">Sections</h3>
          <ul class="footer-list">
            <li><a href="<?= e(url_for('/index.php')) ?>">Home Front Page</a></li>
            <li><a href="<?= e(url_for('/news.php')) ?>">News Archive</a></li>
            <li><a href="<?= e(url_for('/announcements.php')) ?>">Official Announcements</a></li>
            <li><a href="<?= e(url_for('/account.php')) ?>">Reader Account</a></li>
            <li><a href="<?= e(url_for('/index.php#contact')) ?>">Press Desk Contact</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3 class="footer-heading">Campus Desks</h3>
          <ul class="footer-desks">
            <?php foreach ($footerCategories as $cat): ?>
              <li>
                <a href="<?= e(url_for('/news.php?category=' . urlencode((string) $cat['slug']))) ?>">
                  <?= e($cat['name']) ?>
                </a>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; <?= date('Y') ?> Lagos State University — Directorate of Information &amp; Campus Broadcasting.</p>
        <a href="<?= e(url_for('/admin/login.php')) ?>">Editorial Staff Login</a>
      </div>
    </div>
  </footer>
  <script src="<?= e(url_for('/assets/js/main.js')) ?>"></script>
</body>
</html>
