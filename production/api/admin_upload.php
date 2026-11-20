<?php
/**
 * LASU Campus Broadcast - Secure Image Upload API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$admin = require_admin_api();
$cfg = lasu_load_config();
$maxBytes = (int) ($cfg['max_upload_bytes'] ?? (5 * 1024 * 1024));

if (empty($_FILES['image']) || !is_array($_FILES['image'])) {
    json_response(['error' => 'Please select an image file to upload.'], 400);
}

$file = $_FILES['image'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(['error' => 'Upload failed with code ' . (int) $file['error']], 400);
}

if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > $maxBytes) {
    json_response(['error' => 'Image file must be between 1 byte and 5 MB.'], 400);
}

$tmpPath = (string) $file['tmp_name'];
if (!is_uploaded_file($tmpPath)) {
    json_response(['error' => 'Invalid upload source.'], 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? finfo_file($finfo, $tmpPath) : false;
if ($finfo) {
    finfo_close($finfo);
}

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];

if (!is_string($mime) || !isset($allowedMimes[$mime])) {
    json_response(['error' => 'Only JPEG, PNG, WEBP, and GIF image files are allowed.'], 400);
}

// Verify actual image dimensions to reject malformed files
if (@getimagesize($tmpPath) === false) {
    json_response(['error' => 'Uploaded file is not a valid image.'], 400);
}

$uploadDir = dirname(__DIR__) . '/uploads/articles';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    json_response(['error' => 'Failed to create upload directory.'], 500);
}

$ext = $allowedMimes[$mime];
$filename = 'lasu_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$destPath = $uploadDir . '/' . $filename;

if (!move_uploaded_file($tmpPath, $destPath)) {
    json_response(['error' => 'Failed to store uploaded image on server.'], 500);
}

$publicPath = url_for('/uploads/articles/' . $filename);
$pdo = lasu_db();
log_activity($pdo, (int) $admin['id'], 'upload', 'media', null, 'Uploaded image ' . $filename);

json_response(['url' => $publicPath, 'filename' => $filename], 201);
