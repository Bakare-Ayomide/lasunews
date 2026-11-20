<?php
/**
 * LASU Campus Broadcast - Production Configuration Example
 *
 * Copy this file to `config/config.php` and fill in your cPanel MySQL credentials
 * before uploading or running the application on your server.
 */

return [
    // MySQL Database Connection Settings (from cPanel -> MySQL Databases)
    'db_host'    => 'localhost',
    'db_port'    => '3306',
    'db_name'    => 'cpaneluser_lasu_broadcast',
    'db_user'    => 'cpaneluser_lasu_admin',
    'db_pass'    => 'REPLACE_WITH_STRONG_MYSQL_PASSWORD',
    'db_charset' => 'utf8mb4',

    // Application Settings
    'app_name'   => 'LASU Campus Broadcast',
    // Leave base_url empty ('') for automatic detection, or set e.g. 'https://news.lasu.edu.ng'
    'base_url'   => '',
    'timezone'   => 'Africa/Lagos',

    // Upload Constraints
    'max_upload_bytes' => 5 * 1024 * 1024, // 5 MB
    'session_lifetime' => 43200,           // 12 hours in seconds
];
