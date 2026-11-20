<?php
/**
 * LASU Campus Broadcast - Export Advertisement Statistics as Branded PDF
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/pdf_report.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$admin = require_admin_api();
$pdo = lasu_db();

$placement = trim((string) ($_GET['placement'] ?? 'all'));
if (!in_array($placement, ['all', 'top_banner', 'sidebar_box', 'inline_banner'], true)) {
    $placement = 'all';
}

$statusFilter = trim((string) ($_GET['status'] ?? 'all'));
if (!in_array($statusFilter, ['all', 'active', 'paused', 'expired'], true)) {
    $statusFilter = 'all';
}

$sql = 'SELECT * FROM advertisements';
$params = [];
if ($placement !== 'all') {
    $sql .= ' WHERE placement = ?';
    $params[] = $placement;
}
$sql .= ' ORDER BY placement ASC, display_order ASC, clicks DESC, impressions DESC, id DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$nowMs = time() * 1000;
$ads = [];
foreach ($rows as $row) {
    $expMs = ad_expires_at_ms($row['expires_at'] ?? null);
    $row['expires_at_ms'] = $expMs;
    $isExpired = ($expMs !== null && $expMs <= $nowMs);
    $row['is_expired'] = $isExpired ? 1 : 0;

    if ($statusFilter === 'expired' && !$isExpired) {
        continue;
    }
    if ($statusFilter === 'active' && (($row['status'] ?? '') !== 'active' || $isExpired)) {
        continue;
    }
    if ($statusFilter === 'paused' && (($row['status'] ?? '') !== 'paused' || $isExpired)) {
        continue;
    }

    $ads[] = $row;
}

$pdfBinary = build_ads_statistics_pdf($ads, $admin, [
    'placement' => $placement,
    'status'    => $statusFilter,
]);

log_activity(
    $pdo,
    (int) $admin['id'],
    'export_ads_pdf',
    'advertisement',
    null,
    'Exported branded ad statistics PDF (' . count($ads) . ' campaigns, scope: ' . $placement . ')'
);

$filename = 'LASU-Ad-Statistics-Report-' . date('Y-m-d') . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($pdfBinary));
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
echo $pdfBinary;
exit;
