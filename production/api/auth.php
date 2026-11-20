<?php
/**
 * LASU Campus Broadcast - Authentication API Endpoint
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $admin = current_admin();
    if (!$admin) {
        json_response(['authenticated' => false], 401);
    }
    json_response([
        'authenticated' => true,
        'admin' => $admin,
        'csrfToken' => csrf_token(),
    ]);
}

if ($method === 'POST') {
    $body = get_json_body();
    $action = (string) ($body['action'] ?? 'login');

    if ($action === 'logout') {
        $admin = require_admin_api($body);
        logout_admin();
        json_response(['success' => true]);
    }

    $email = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    if ($email === '' || $password === '') {
        json_response(['error' => 'Email and password are required.'], 400);
    }

    $result = attempt_admin_login($email, $password);
    if (!$result['ok']) {
        json_response(['error' => $result['error']], 401);
    }

    json_response([
        'admin' => $result['admin'],
        'csrfToken' => $result['csrfToken'],
    ]);
}

json_response(['error' => 'Method not allowed.'], 405);
