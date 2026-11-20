<?php
/**
 * LASU Campus Broadcast - Public Reader Account (Login, Registration & Comment History)
 */
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

start_secure_session();
$pdo = lasu_db();

if (($_GET['action'] ?? '') === 'logout') {
    logout_user();
    header('Location: ' . url_for('/account.php'));
    exit;
}

$error = null;
$mode = ($_GET['mode'] ?? $_POST['mode'] ?? 'login') === 'register' ? 'register' : 'login';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $csrf = request_csrf_token($_POST);
    if (!verify_csrf_token($csrf)) {
        $error = 'Security token expired. Please refresh the page and try again.';
    } else {
        if ($mode === 'register') {
            $res = register_public_user(
                (string) ($_POST['full_name'] ?? ''),
                (string) ($_POST['email'] ?? ''),
                (string) ($_POST['password'] ?? ''),
                (string) ($_POST['department'] ?? '')
            );
            if ($res['ok']) {
                header('Location: ' . url_for('/account.php'));
                exit;
            }
            $error = $res['error'] ?? 'Registration failed.';
        } else {
            $res = attempt_user_login(
                (string) ($_POST['email'] ?? ''),
                (string) ($_POST['password'] ?? '')
            );
            if ($res['ok']) {
                header('Location: ' . url_for('/account.php'));
                exit;
            }
            $error = $res['error'] ?? 'Sign in failed.';
        }
    }
}

$user = current_user();
$csrfToken = csrf_token();

$myComments = [];
if ($user) {
    $cStmt = $pdo->prepare(
        "SELECT cm.*, a.title AS article_title, a.slug AS article_slug
         FROM comments cm
         INNER JOIN articles a ON a.id = cm.article_id
         WHERE cm.user_id = ?
         ORDER BY cm.created_at DESC"
    );
    $cStmt->execute([(int) $user['id']]);
    $myComments = $cStmt->fetchAll();
}

$pageTitle = 'Reader Account — LASU Campus Broadcast';
$activeNav = '';
require __DIR__ . '/includes/header.php';
?>

<section class="section" style="border-bottom:none;">
  <div class="container">
    <?php if ($user): ?>
      <div style="max-width:860px;margin:0 auto;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;padding-bottom:1.5rem;border-bottom:1px solid var(--lasu-border);margin-bottom:2rem;">
          <div>
            <p class="kicker">LASU Reader Profile</p>
            <h1 class="section-title" style="font-size:2rem;"><?= e($user['full_name']) ?></h1>
            <p style="font-size:0.85rem;color:var(--lasu-muted);margin-top:0.25rem;">
              <?= e($user['email']) ?><?= !empty($user['department']) ? ' · ' . e($user['department']) : '' ?>
            </p>
          </div>
          <div style="display:flex;gap:0.75rem;">
            <a href="<?= e(url_for('/news.php')) ?>" class="btn btn-outline btn-sm">Browse News</a>
            <a href="<?= e(url_for('/account.php?action=logout')) ?>" class="btn btn-primary btn-sm">Sign Out</a>
          </div>
        </div>

        <div style="background:#fff;border:1px solid var(--lasu-border);">
          <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--lasu-border);">
            <h2 style="font-size:1.15rem;">My Submitted Comments (<?= count($myComments) ?>)</h2>
          </div>
          <?php if (empty($myComments)): ?>
            <div style="padding:2rem;text-align:center;font-size:0.875rem;color:var(--lasu-muted);">
              You have not posted any article comments yet. Open any published dispatch to join the campus discussion.
            </div>
          <?php else: ?>
            <div>
              <?php foreach ($myComments as $cm): ?>
                <div class="comment-card">
                  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;font-size:0.75rem;margin-bottom:0.35rem;">
                    <a href="<?= e(url_for('/article.php?slug=' . urlencode((string) $cm['article_slug']))) ?>" style="font-weight:700;color:var(--lasu-navy);">
                      <?= e($cm['article_title']) ?>
                    </a>
                    <span style="font-weight:700;text-transform:uppercase;color:<?= $cm['status'] === 'approved' ? '#065F46' : ($cm['status'] === 'rejected' ? '#991B1B' : '#92400E') ?>;">
                      <?= e($cm['status']) ?>
                    </span>
                  </div>
                  <p style="font-size:0.9rem;"><?= nl2br(e($cm['content'])) ?></p>
                  <p class="font-mono" style="font-size:0.72rem;color:var(--lasu-muted);margin-top:0.35rem;"><?= e(format_datetime($cm['created_at'])) ?></p>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>
      </div>
    <?php else: ?>
      <div style="max-width:440px;margin:0 auto;">
        <div class="form-card">
          <div style="margin-bottom:1.25rem;">
            <a href="<?= e(url_for('/index.php')) ?>" style="font-size:0.75rem;font-weight:600;color:var(--lasu-muted);">&larr; Back to LASU News</a>
            <h1 style="font-size:1.65rem;margin-top:0.75rem;">LASU Reader Account</h1>
            <p style="font-size:0.8rem;color:var(--lasu-muted);margin-top:0.25rem;">
              Sign in or register as a student, lecturer, or alumnus to join article discussions.
            </p>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem;padding:0.25rem;background:var(--lasu-paper);border:1px solid var(--lasu-border-soft);margin-bottom:1.25rem;">
            <a href="<?= e(url_for('/account.php?mode=login')) ?>"
               style="text-align:center;padding:0.5rem;font-size:0.75rem;font-weight:600;<?= $mode === 'login' ? 'background:var(--lasu-navy);color:#fff;' : 'color:var(--lasu-muted);' ?>">
              Sign In
            </a>
            <a href="<?= e(url_for('/account.php?mode=register')) ?>"
               style="text-align:center;padding:0.5rem;font-size:0.75rem;font-weight:600;<?= $mode === 'register' ? 'background:var(--lasu-navy);color:#fff;' : 'color:var(--lasu-muted);' ?>">
              Create Account
            </a>
          </div>

          <?php if ($error): ?>
            <div class="alert alert-error"><?= e($error) ?></div>
          <?php endif; ?>

          <form method="post" action="<?= e(url_for('/account.php?mode=' . $mode)) ?>">
            <input type="hidden" name="_csrf" value="<?= e($csrfToken) ?>">
            <input type="hidden" name="mode" value="<?= e($mode) ?>">

            <?php if ($mode === 'register'): ?>
              <div class="form-group">
                <label for="uFullName" class="form-label">Full Name</label>
                <input id="uFullName" name="full_name" type="text" required class="input" placeholder="e.g., Tunde Bakare">
              </div>
              <div class="form-group">
                <label for="uDepartment" class="form-label">Faculty / Department (optional)</label>
                <input id="uDepartment" name="department" type="text" class="input" placeholder="e.g., Mass Communication">
              </div>
            <?php endif; ?>

            <div class="form-group">
              <label for="uEmail" class="form-label">Email Address</label>
              <input id="uEmail" name="email" type="email" required class="input" placeholder="student@lasu.edu.ng">
            </div>

            <div class="form-group">
              <label for="uPassword" class="form-label">Password</label>
              <input id="uPassword" name="password" type="password" required minlength="6" class="input" placeholder="Minimum 6 characters">
            </div>

            <button type="submit" class="btn btn-primary btn-block">
              <?= $mode === 'register' ? 'Register Reader Account' : 'Sign In' ?>
            </button>
          </form>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
