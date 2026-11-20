<?php
/**
 * LASU Campus Broadcast - Administrator Login Page
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (current_admin() !== null) {
    header('Location: ' . url_for('/admin/index.php'));
    exit;
}

start_secure_session();
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $token = $_POST['_csrf'] ?? '';
    if (!verify_csrf_token(is_string($token) ? $token : null)) {
        $error = 'Security token mismatch. Please refresh and try again.';
    } else {
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $res = attempt_admin_login($email, $password);
        if ($res['ok']) {
            header('Location: ' . url_for('/admin/index.php'));
            exit;
        }
        $error = (string) ($res['error'] ?? 'Sign-in failed.');
    }
}

$token = csrf_token();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administrator Sign In — LASU Campus Broadcast</title>
  <link rel="icon" type="image/png" href="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png">
  <link rel="stylesheet" href="<?= e(url_for('/assets/css/admin.css')) ?>">
</head>
<body>
  <main class="login-shell">
    <div class="login-card">
      <a href="<?= e(url_for('/index.php')) ?>" style="font-size:0.75rem;font-weight:600;color:var(--lasu-muted);text-decoration:none;">
        &larr; Return to Public Site
      </a>
      <div style="margin-top:0.9rem;">
        <img src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png" alt="Lagos State University" style="height:2.75rem;width:auto;object-fit:contain;">
      </div>
      <h1 style="font-size:1.65rem;margin-top:0.75rem;color:var(--lasu-navy);">Editorial Admin Portal</h1>
      <p style="font-size:0.8rem;color:var(--lasu-muted);margin:0.3rem 0 1.5rem;">
        Lagos State University Campus Broadcasting Desk
      </p>

      <?php if ($error !== ''): ?>
        <div class="alert alert-error"><?= e($error) ?></div>
      <?php endif; ?>

      <form method="post" action="<?= e(url_for('/admin/login.php')) ?>">
        <input type="hidden" name="_csrf" value="<?= e($token) ?>">

        <div class="form-group">
          <label for="email" class="form-label">Official Email</label>
          <input id="email" type="email" name="email" required autocomplete="email" class="input" placeholder="admin@lasu.edu.ng">
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input id="password" type="password" name="password" required autocomplete="current-password" class="input" placeholder="Enter administrator password">
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;padding:0.7rem;">
          Sign In to Dashboard
        </button>
      </form>
    </div>
  </main>
</body>
</html>
