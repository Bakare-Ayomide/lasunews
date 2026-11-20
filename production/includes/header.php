<?php
/**
 * LASU Campus Broadcast - Public Site Header Template
 * Expected optional variables: $pageTitle, $pageDescription, $activeNav
 */
declare(strict_types=1);

$pageTitle = $pageTitle ?? 'LASU News — Lagos State University Campus Broadcasting System';
$pageDescription = $pageDescription ?? 'Official Campus News Broadcasting System and Editorial Portal for Lagos State University (Ojo, Epe & Ikeja Campuses).';
$activeNav = $activeNav ?? 'home';
$loggedAdmin = function_exists('current_admin') ? current_admin() : null;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($pageTitle) ?></title>
  <meta name="description" content="<?= e($pageDescription) ?>">
  <meta property="og:title" content="<?= e($pageTitle) ?>">
  <meta property="og:description" content="<?= e($pageDescription) ?>">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png">
  <link rel="icon" type="image/png" href="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png">
  <link rel="stylesheet" href="<?= e(url_for('/assets/css/style.css')) ?>">
</head>
<body data-base-path="<?= e(app_base_path()) ?>">
  <header class="site-header">
    <div class="container header-inner">
      <a href="<?= e(url_for('/index.php')) ?>" class="brand-wordmark" aria-label="LASU Campus Broadcast Home">
        <img src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png" alt="Lagos State University (LASU) Broadcast" class="brand-logo">
      </a>

      <nav class="main-nav" aria-label="Primary Navigation">
        <a href="<?= e(url_for('/index.php')) ?>" class="nav-link <?= $activeNav === 'home' ? 'is-active' : '' ?>">Home</a>
        <a href="<?= e(url_for('/news.php')) ?>" class="nav-link <?= $activeNav === 'news' ? 'is-active' : '' ?>">News</a>
        <a href="<?= e(url_for('/announcements.php')) ?>" class="nav-link <?= $activeNav === 'announcements' ? 'is-active' : '' ?>">Announcements</a>
        <a href="<?= e(url_for('/index.php#about')) ?>" class="nav-link">About</a>
        <a href="<?= e(url_for('/index.php#contact')) ?>" class="nav-link">Contact</a>
      </nav>

      <div class="header-actions">
        <a href="<?= e(url_for($loggedAdmin ? '/admin/index.php' : '/admin/login.php')) ?>" class="btn btn-primary btn-sm hide-mobile">
          <?= $loggedAdmin ? 'Dashboard' : 'Admin Portal' ?>
        </a>
        <button type="button" id="mobileMenuBtn" class="mobile-menu-btn" aria-label="Toggle navigation" aria-expanded="false">
          <span class="menu-bars"></span>
        </button>
      </div>
    </div>

    <div id="mobileDrawer" class="mobile-drawer" hidden>
      <a href="<?= e(url_for('/index.php')) ?>" class="mobile-nav-link">Home</a>
      <a href="<?= e(url_for('/news.php')) ?>" class="mobile-nav-link">News</a>
      <a href="<?= e(url_for('/announcements.php')) ?>" class="mobile-nav-link">Announcements</a>
      <a href="<?= e(url_for('/index.php#about')) ?>" class="mobile-nav-link">About</a>
      <a href="<?= e(url_for('/index.php#contact')) ?>" class="mobile-nav-link">Contact</a>
      <a href="<?= e(url_for('/account.php')) ?>" class="mobile-nav-link">Reader Account</a>
      <a href="<?= e(url_for($loggedAdmin ? '/admin/index.php' : '/admin/login.php')) ?>" class="btn btn-primary btn-block">
        <?= $loggedAdmin ? 'Admin Dashboard' : 'Admin Portal' ?>
      </a>
    </div>
  </header>
  <main>
