<?php
/**
 * LASU Campus Broadcast - Admin Advertisements Management API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = in_array($method, ['POST', 'PUT', 'DELETE'], true) ? get_json_body() : [];
$admin = require_admin_api($body);
$pdo = lasu_db();

$validPlacements = ['top_banner', 'sidebar_box', 'inline_banner'];
$validUnits = ['none', 'seconds', 'minutes', 'hours', 'days', 'months'];

function enrich_ad_row(array $ad): array
{
    $expMs = ad_expires_at_ms($ad['expires_at'] ?? null);
    $nowMs = time() * 1000;
    $ad['expires_at_ms'] = $expMs;
    $ad['is_expired'] = ($expMs !== null && $expMs <= $nowMs) ? 1 : 0;
    $ad['remaining_seconds'] = $expMs !== null ? max(0, (int) floor(($expMs - $nowMs) / 1000)) : null;
    return $ad;
}

if ($method === 'GET') {
    $ads = $pdo->query('SELECT * FROM advertisements ORDER BY placement ASC, display_order ASC, created_at DESC, id DESC')->fetchAll();
    $ads = array_map('enrich_ad_row', $ads);
    json_response(['ads' => $ads]);
}

if ($method === 'POST') {
    $title = trim((string) ($body['title'] ?? ''));
    $advertiser = trim((string) ($body['advertiser_name'] ?? ''));
    $imageUrl = trim((string) ($body['image_url'] ?? ''));
    $targetUrl = trim((string) ($body['target_url'] ?? ''));
    $placement = in_array($body['placement'] ?? '', $validPlacements, true) ? (string) $body['placement'] : 'sidebar_box';
    $status = ($body['status'] ?? 'active') === 'paused' ? 'paused' : 'active';
    $displayOrder = max(0, (int) ($body['display_order'] ?? 0));
    $durationUnit = in_array($body['duration_unit'] ?? '', $validUnits, true) ? (string) $body['duration_unit'] : 'none';
    $durationValue = isset($body['duration_value']) && $body['duration_value'] !== '' ? max(0, (int) $body['duration_value']) : 0;

    if (mb_strlen($title) < 3 || mb_strlen($title) > 160) {
        json_response(['error' => 'Campaign title must be 3–160 characters.'], 400);
    }
    if (mb_strlen($advertiser) < 2 || mb_strlen($advertiser) > 120) {
        json_response(['error' => 'Advertiser / sponsor name is required.'], 400);
    }
    if ($targetUrl !== '' && !filter_var($targetUrl, FILTER_VALIDATE_URL)) {
        json_response(['error' => 'Target URL must be a valid http/https URL or left blank.'], 400);
    }

    $dur = compute_ad_expiry($durationValue, $durationUnit);

    $stmt = $pdo->prepare(
        'INSERT INTO advertisements (title, advertiser_name, image_url, target_url, placement, status, duration_value, duration_unit, expires_at, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $title,
        $advertiser,
        $imageUrl,
        $targetUrl,
        $placement,
        $status,
        $dur['duration_value'],
        $dur['duration_unit'],
        $dur['expires_at'],
        $displayOrder,
    ]);
    $newId = (int) $pdo->lastInsertId();

    log_activity($pdo, (int) $admin['id'], 'create_ad', 'advertisement', $newId, 'Created ad "' . $title . '" (' . $placement . ')');
    $fetch = $pdo->prepare('SELECT * FROM advertisements WHERE id = ?');
    $fetch->execute([$newId]);
    json_response(['ad' => enrich_ad_row($fetch->fetch())], 201);
}

if ($method === 'PUT') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM advertisements WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Advertisement not found.'], 404);
    }

    $title = trim((string) ($body['title'] ?? ''));
    $advertiser = trim((string) ($body['advertiser_name'] ?? ''));
    $imageUrl = trim((string) ($body['image_url'] ?? ''));
    $targetUrl = trim((string) ($body['target_url'] ?? ''));
    $placement = in_array($body['placement'] ?? '', $validPlacements, true) ? (string) $body['placement'] : 'sidebar_box';
    $status = ($body['status'] ?? 'active') === 'paused' ? 'paused' : 'active';
    $displayOrder = max(0, (int) ($body['display_order'] ?? ($existing['display_order'] ?? 0)));
    $durationUnit = in_array($body['duration_unit'] ?? '', $validUnits, true) ? (string) $body['duration_unit'] : 'none';
    $durationValue = isset($body['duration_value']) && $body['duration_value'] !== '' ? max(0, (int) $body['duration_value']) : 0;
    $restartDuration = !empty($body['restart_duration']);

    if (mb_strlen($title) < 3 || mb_strlen($title) > 160) {
        json_response(['error' => 'Campaign title must be 3–160 characters.'], 400);
    }
    if (mb_strlen($advertiser) < 2 || mb_strlen($advertiser) > 120) {
        json_response(['error' => 'Advertiser / sponsor name is required.'], 400);
    }
    if ($targetUrl !== '' && !filter_var($targetUrl, FILTER_VALIDATE_URL)) {
        json_response(['error' => 'Target URL must be a valid http/https URL or left blank.'], 400);
    }

    $prevVal = (int) ($existing['duration_value'] ?? 0);
    $prevUnit = (string) ($existing['duration_unit'] ?? 'none');
    $durationChanged = ($durationUnit !== $prevUnit) || ($durationValue !== $prevVal);

    if ($durationUnit === 'none' || $durationValue <= 0) {
        $finalVal = null;
        $finalUnit = 'none';
        $finalExpiresAt = null;
    } elseif ($restartDuration || $durationChanged) {
        $dur = compute_ad_expiry($durationValue, $durationUnit);
        $finalVal = $dur['duration_value'];
        $finalUnit = $dur['duration_unit'];
        $finalExpiresAt = $dur['expires_at'];
    } else {
        $finalVal = $existing['duration_value'];
        $finalUnit = $existing['duration_unit'];
        $finalExpiresAt = $existing['expires_at'];
    }

    $pdo->prepare(
        'UPDATE advertisements
         SET title = ?, advertiser_name = ?, image_url = ?, target_url = ?, placement = ?, status = ?,
             duration_value = ?, duration_unit = ?, expires_at = ?, display_order = ?
         WHERE id = ?'
    )->execute([
        $title,
        $advertiser,
        $imageUrl,
        $targetUrl,
        $placement,
        $status,
        $finalVal,
        $finalUnit,
        $finalExpiresAt,
        $displayOrder,
        $id,
    ]);

    log_activity($pdo, (int) $admin['id'], 'update_ad', 'advertisement', $id, 'Updated ad "' . $title . '" (' . $status . ')');
    $fetch = $pdo->prepare('SELECT * FROM advertisements WHERE id = ?');
    $fetch->execute([$id]);
    json_response(['ad' => enrich_ad_row($fetch->fetch())]);
}

if ($method === 'DELETE') {
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, title FROM advertisements WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Advertisement not found.'], 404);
    }

    $pdo->prepare('DELETE FROM advertisements WHERE id = ?')->execute([$id]);
    log_activity($pdo, (int) $admin['id'], 'delete_ad', 'advertisement', $id, 'Deleted ad "' . $existing['title'] . '"');
    json_response(['success' => true]);
}

json_response(['error' => 'Method not allowed.'], 405);
