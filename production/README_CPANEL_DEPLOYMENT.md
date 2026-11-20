# LASU Campus Broadcast — cPanel Production Deployment Guide

This `/production` directory is a **100% self-contained PHP 8.x + MySQL + HTML5 + CSS3 + Vanilla JavaScript** web application built specifically for standard Apache cPanel shared hosting. It has zero dependency on Node.js, Python, or external build tools.

---

## System Requirements
- **Web Server**: Apache with `mod_rewrite` and `mod_headers` enabled (standard on cPanel).
- **PHP**: PHP 8.0 or higher with `pdo_mysql`, `fileinfo`, and `mbstring` extensions enabled.
- **Database**: MySQL 5.7+ / MySQL 8.0+ or MariaDB 10.4+.

---

## Step 1: Create the MySQL Database & User in cPanel
1. Log in to your **cPanel** control panel.
2. Open **MySQL® Databases** (or **MySQL® Database Wizard**).
3. Create a new database (e.g., `yourcpanel_lasunews`).
4. Create a new database user with a strong password (e.g., `yourcpanel_lasuuser`).
5. Add the user to the database and grant **ALL PRIVILEGES**.

---

## Step 2: Import the Database Schema (`install.sql`)
1. In cPanel, open **phpMyAdmin**.
2. Select your newly created database from the left sidebar.
3. Click the **Import** tab at the top.
4. Choose `/database/install.sql` from this package and click **Go** / **Import**.
5. Verify that 8 tables (`categories`, `admins`, `users`, `articles`, `comments`, `advertisements`, `activity_logs`, `contact_messages`) are created, along with the 6 default color-coded LASU news categories, **30 pre-populated official LASU news stories** (matching assets in `uploads/articles/`), and the initial Super Administrator account.

---

## Step 3: Configure Database Credentials
1. Inside `/config/`, duplicate `config.example.php` and rename the copy to **`config.php`**.
2. Open `config/config.php` and enter your cPanel MySQL details:
   ```php
   return [
       'db_host'    => 'localhost',
       'db_port'    => '3306',
       'db_name'    => 'yourcpanel_lasunews',
       'db_user'    => 'yourcpanel_lasuuser',
       'db_pass'    => 'YOUR_MYSQL_PASSWORD',
       'db_charset' => 'utf8mb4',
       'app_name'   => 'LASU Campus Broadcast',
       'base_url'   => '', // Auto-detected, or set e.g. 'https://news.yourdomain.com'
       'timezone'   => 'Africa/Lagos',
       'max_upload_bytes' => 5 * 1024 * 1024,
       'session_lifetime' => 43200,
   ];
   ```

---

## Step 4: Upload Files to cPanel
1. Open **File Manager** in cPanel (or connect via SFTP/FTP).
2. Navigate to `public_html/` (or a subdirectory/subdomain folder such as `public_html/news/`).
3. Upload **all contents** of `/production` into that folder (ensuring `.htaccess` and `uploads/.htaccess` are included — enable *"Show Hidden Files (dotfiles)"* in File Manager settings).
4. Confirm folder permissions on `uploads/articles/` are writable by PHP (`0755` on most cPanel suPHP/PHP-FPM servers).

---

## Step 5: First Sign-In & Security Hardening
1. Visit your domain (e.g., `https://yourdomain.com/`). You will immediately see the broadsheet landing page with the official LASU logo, breaking-news ticker, featured stories, category-colored desks, and the 30 seeded LASU broadcasts.
2. Visit `https://yourdomain.com/admin/login.php`.
3. Sign in with the seeded Super Administrator credentials:
   - **Email**: `admin@lasu.edu.ng`
   - **Password**: `LasuBroadcast2026!`
4. Immediately navigate to **Administrators** inside the dashboard, click **Edit** on your account, and set a new strong private password.
5. Explore the editorial console tabs: **Overview**, **News & Bulletins**, **Performance & Stats** (readership analytics), **News Wire & Sources** (live multi-source headlines & RSS/Atom importer), **Categories**, **Comments & Moderation**, **Advertisements**, **Reader Accounts** (full user CRUD), **Administrators**, **Publishing Activity**, and **Press Inquiries**.
6. Delete `/database/install.sql` from the server if desired (though `.htaccess` already blocks browser access to `/database/`, `/config/`, and `/includes/`).
