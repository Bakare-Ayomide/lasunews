<?php
/**
 * LASU Campus Broadcast - Contact & Press Inquiry Submission API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = get_json_body();
if (empty($body)) {
    $body = $_POST;
}

$senderName = trim((string) ($body['sender_name'] ?? ''));
$senderEmail = trim((string) ($body['sender_email'] ?? ''));
$subject = trim((string) ($body['subject'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));

if (mb_strlen($senderName) < 2 || mb_strlen($senderName) > 100) {
    json_response(['error' => 'Please provide your full name (2–100 characters).'], 400);
}
if (!filter_var($senderEmail, FILTER_VALIDATE_EMAIL)) {
    json_response(['error' => 'Please provide a valid email address.'], 400);
}
if (mb_strlen($subject) < 3 || mb_strlen($subject) > 160) {
    json_response(['error' => 'Please enter a subject (3–160 characters).'], 400);
}
if (mb_strlen($message) < 10 || mb_strlen($message) > 3000) {
    json_response(['error' => 'Please enter a message (10–3000 characters).'], 400);
}

$pdo = lasu_db();
$stmt = $pdo->prepare(
    'INSERT INTO contact_messages (sender_name, sender_email, subject, message) VALUES (?, ?, ?, ?)'
);
$stmt->execute([$senderName, $senderEmail, $subject, $message]);

json_response([
    'success' => true,
    'message' => 'Your dispatch has been received by the LASU Broadcasting Directorate.',
], 201);
