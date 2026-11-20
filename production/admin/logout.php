<?php
/**
 * LASU Campus Broadcast - Secure Administrator Logout
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

logout_admin();
header('Location: ' . url_for('/admin/login.php'));
exit;
