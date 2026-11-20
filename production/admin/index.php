<?php
/**
 * LASU Campus Broadcast - Administrator Dashboard Workspace
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$admin = require_admin_page();
$csrf = csrf_token();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editorial Dashboard — LASU Campus Broadcast</title>
  <link rel="icon" type="image/png" href="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png">
  <link rel="stylesheet" href="<?= e(url_for('/assets/css/admin.css')) ?>">
</head>
<body>
  <div id="adminApp"
       class="admin-layout"
       data-base-path="<?= e(app_base_path()) ?>"
       data-csrf="<?= e($csrf) ?>"
       data-admin-id="<?= (int) $admin['id'] ?>"
       data-admin-role="<?= e($admin['role']) ?>">

    <aside id="adminSidebar" class="admin-sidebar">
      <div>
        <div class="sidebar-brand">
          <div style="background:#FFFFFF;padding:0.25rem 0.55rem;border-radius:0.25rem;display:inline-flex;align-items:center;">
            <img src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png" alt="LASU Editorial" style="height:1.75rem;width:auto;object-fit:contain;display:block;">
          </div>
          <button type="button" id="closeSidebarBtn" class="mobile-only" style="background:none;border:none;color:#fff;font-size:1.25rem;cursor:pointer;" aria-label="Close menu">&times;</button>
        </div>

        <nav class="sidebar-nav" aria-label="Dashboard Sections">
          <button type="button" class="sidebar-btn is-active" data-tab-target="overview">Overview</button>
          <button type="button" class="sidebar-btn" data-tab-target="articles">News &amp; Bulletins</button>
          <button type="button" class="sidebar-btn" data-tab-target="analytics">Performance &amp; Stats</button>
          <button type="button" class="sidebar-btn" data-tab-target="sources">News Wire &amp; Sources</button>
          <button type="button" class="sidebar-btn" data-tab-target="categories">Categories</button>
          <button type="button" class="sidebar-btn" data-tab-target="comments">
            <span>Comments &amp; Moderation</span>
            <span id="pendingCommentsCount" class="font-mono tabular-nums" style="color:var(--lasu-gold);"></span>
          </button>
          <button type="button" class="sidebar-btn" data-tab-target="ads">Advertisements</button>
          <button type="button" class="sidebar-btn" data-tab-target="users">Reader Accounts</button>
          <button type="button" class="sidebar-btn" data-tab-target="admins">Administrators</button>
          <button type="button" class="sidebar-btn" data-tab-target="activity">Publishing Activity</button>
          <button type="button" class="sidebar-btn" data-tab-target="messages">
            <span>Press Inquiries</span>
            <span id="unreadMessagesCount" class="font-mono tabular-nums" style="color:var(--lasu-gold);"></span>
          </button>
        </nav>
      </div>

      <div class="sidebar-footer">
        <div style="margin-bottom:0.75rem;">
          <div style="font-weight:600;color:#fff;"><?= e($admin['full_name']) ?></div>
          <div style="color:#94A3B8;"><?= e($admin['email']) ?></div>
          <div style="color:var(--lasu-gold);text-transform:uppercase;font-size:0.68rem;margin-top:0.2rem;">
            <?= $admin['role'] === 'super_admin' ? 'Super Admin' : 'Editor' ?>
          </div>
        </div>
        <div style="display:grid;gap:0.35rem;">
          <a href="<?= e(url_for('/index.php')) ?>" style="color:#E2E8F0;text-decoration:none;padding:0.35rem 0;">View Public Portal</a>
          <a href="<?= e(url_for('/admin/logout.php')) ?>" style="color:#E2E8F0;text-decoration:none;padding:0.35rem 0;">Sign Out</a>
        </div>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <button type="button" id="openSidebarBtn" class="btn btn-outline mobile-only">Menu</button>
          <div style="font-size:0.85rem;color:var(--lasu-muted);">
            LASU Broadcast Admin / <strong id="breadcrumbTabTitle" style="color:var(--lasu-ink);">Overview</strong>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" id="newAnnouncementBtn" class="btn btn-outline">Post Announcement</button>
          <button type="button" id="newArticleBtn" class="btn btn-primary">+ New Article</button>
        </div>
      </header>

      <main class="admin-content">
        <div id="adminFeedback" class="alert" hidden></div>

        <!-- OVERVIEW PANEL -->
        <section data-tab-panel="overview">
          <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
            <div class="stat-box"><div class="stat-label">Published</div><div id="statPublished" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Drafts</div><div id="statDrafts" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Breaking</div><div id="statBreaking" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Pending Comments</div><div id="statPendingComments" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Active Ads</div><div id="statActiveAds" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Reader Accounts</div><div id="statUsers" class="stat-num tabular-nums">0</div></div>
            <div class="stat-box"><div class="stat-label">Total Reads</div><div id="statViews" class="stat-num tabular-nums">0</div></div>
          </div>

          <div class="split-grid">
            <div class="panel">
              <div class="panel-head">
                <h2 style="font-size:1.05rem;">Recent News &amp; Drafts</h2>
              </div>
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>Headline</th><th>Category</th><th>Status</th><th style="text-align:right;">Reads</th></tr>
                  </thead>
                  <tbody id="overviewArticlesBody"></tbody>
                </table>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head">
                <h2 style="font-size:1.05rem;">Recent Activity</h2>
              </div>
              <div id="overviewActivityList" class="panel-body"></div>
            </div>
          </div>
        </section>

        <!-- ARTICLES PANEL -->
        <section data-tab-panel="articles" hidden>
          <div class="panel">
            <div class="panel-body toolbar-grid">
              <input id="filterArticleSearch" type="search" class="input" placeholder="Search articles by title or text...">
              <select id="filterArticleStatus" class="select">
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
              <select id="filterArticleCategory" class="select">
                <option value="all">All Categories</option>
              </select>
              <select id="filterArticleType" class="select">
                <option value="all">All Types</option>
                <option value="breaking">Breaking Ticker</option>
                <option value="featured">Featured Only</option>
                <option value="announcement">Announcements</option>
                <option value="news">Standard News</option>
              </select>
            </div>
          </div>

          <div class="panel">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Article</th><th>Category</th><th>Placement</th><th>Status</th><th style="text-align:right;">Reads</th><th>Date</th><th style="text-align:right;">Actions</th></tr>
                </thead>
                <tbody id="articlesTableBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- PERFORMANCE & ANALYTICS PANEL -->
        <section data-tab-panel="analytics" hidden>
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
            <div>
              <h2 style="font-size:1.15rem;">Newsroom Performance &amp; Readership Analytics</h2>
              <p style="margin:0.2rem 0 0;font-size:0.8rem;color:var(--lasu-muted);">Live MySQL metrics across all published dispatches, drafts, desks, comments, and sponsors.</p>
            </div>
            <button type="button" id="refreshAnalyticsBtn" class="btn btn-outline">Refresh Metrics</button>
          </div>

          <div id="analyticsSummaryGrid" class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));"></div>

          <div class="panel">
            <div class="panel-head">
              <h3 style="font-size:1.05rem;">Category Desk Performance</h3>
            </div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Desk</th>
                    <th style="text-align:right;">Published</th>
                    <th style="text-align:right;">Total</th>
                    <th style="text-align:right;">Total Views</th>
                    <th style="text-align:right;">Avg Views</th>
                    <th style="text-align:right;">Comments</th>
                    <th>Readership Share</th>
                  </tr>
                </thead>
                <tbody id="analyticsCategoriesBody"></tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head" style="flex-wrap:wrap;gap:0.75rem;">
              <h3 style="font-size:1.05rem;">All Articles Performance Leaderboard</h3>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                <input id="analyticsSearch" type="search" class="input" style="width:200px;" placeholder="Filter stories...">
                <select id="analyticsCategoryFilter" class="select" style="width:auto;">
                  <option value="all">All Desks</option>
                </select>
                <select id="analyticsSort" class="select" style="width:auto;">
                  <option value="views_desc">Most Read</option>
                  <option value="views_asc">Least Read</option>
                  <option value="comments_desc">Most Commented</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Headline &amp; Author</th>
                    <th>Desk</th>
                    <th>Status</th>
                    <th>Placement</th>
                    <th style="text-align:right;">Views</th>
                    <th style="text-align:right;">Comments</th>
                    <th>Date</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="analyticsArticlesBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- MULTI-SOURCE NEWS WIRE PANEL -->
        <section data-tab-panel="sources" hidden>
          <div class="panel">
            <div class="panel-head" style="flex-wrap:wrap;gap:0.75rem;">
              <div>
                <h2 style="font-size:1.15rem;">Multi-Source News Wire &amp; Live Headlines</h2>
                <p style="margin:0.2rem 0 0;font-size:0.8rem;color:var(--lasu-muted);">Fetch real headlines from LASU Official Newsroom, Nigerian dailies, BBC Africa, or any custom RSS/Atom feed URL.</p>
              </div>
              <button type="button" id="refreshSourcesBtn" class="btn btn-primary">Refresh Live Wire</button>
            </div>
            <div class="panel-body">
              <form id="sourcesFilterForm" class="toolbar-grid" style="margin-bottom:1rem;">
                <input id="sourceSearch" type="search" class="input" placeholder="Filter headlines by keyword...">
                <select id="sourceSelect" class="select">
                  <option value="all">All Live Sources</option>
                  <option value="lasu">LASU Official Newsroom</option>
                  <option value="punch">Punch Nigeria</option>
                  <option value="vanguard">Vanguard Nigeria</option>
                  <option value="channels">Channels TV</option>
                  <option value="premiumtimes">Premium Times</option>
                  <option value="dailypost">Daily Post Nigeria</option>
                  <option value="bbcafrica">BBC Africa</option>
                </select>
                <input id="sourceCustomUrl" type="url" class="input" placeholder="Optional custom RSS/Atom feed URL...">
                <button type="submit" class="btn btn-outline">Fetch Feed</button>
              </form>
              <div id="sourceStatusBar" style="display:flex;flex-wrap:wrap;gap:0.4rem;"></div>
            </div>
          </div>

          <div id="sourcesGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;"></div>
        </section>

        <!-- CATEGORIES PANEL -->
        <section data-tab-panel="categories" hidden>
          <div class="split-grid">
            <div class="panel">
              <div class="panel-head"><h2 style="font-size:1.05rem;">Manage Category</h2></div>
              <form id="categoryForm" class="panel-body">
                <input type="hidden" id="catEditId">
                <div class="form-group">
                  <label for="catName" class="form-label">Category Name</label>
                  <input id="catName" type="text" required class="input" placeholder="e.g., Research & Innovation">
                </div>
                <div class="form-group">
                  <label for="catColor" class="form-label">Editorial Desk Color</label>
                  <div style="display:flex;align-items:center;gap:0.75rem;">
                    <input id="catColor" type="color" value="#0B2545" style="width:46px;height:38px;border:1px solid var(--lasu-border);padding:2px;background:#fff;cursor:pointer;">
                    <span id="catColorLabel" class="font-mono" style="font-size:0.8rem;color:var(--lasu-muted);">#0B2545</span>
                  </div>
                </div>
                <div class="form-group">
                  <label for="catDescription" class="form-label">Description</label>
                  <textarea id="catDescription" rows="3" class="textarea" placeholder="Brief scope for this editorial desk..."></textarea>
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button type="submit" id="catSubmitBtn" class="btn btn-primary">Create Category</button>
                  <button type="button" id="catCancelBtn" class="btn btn-outline" hidden>Cancel</button>
                </div>
              </form>
            </div>

            <div class="panel">
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>Category</th><th style="text-align:right;">Total</th><th style="text-align:right;">Published</th><th style="text-align:right;">Actions</th></tr>
                  </thead>
                  <tbody id="categoriesTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- COMMENTS & MODERATION PANEL -->
        <section data-tab-panel="comments" hidden>
          <div class="panel">
            <div class="panel-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
              <h2 style="font-size:1.05rem;">Comments &amp; Editorial Moderation</h2>
              <select id="filterCommentStatus" class="select" style="width:auto;">
                <option value="all">All Comments</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div id="commentsModerationList"></div>
          </div>
        </section>

        <!-- ADVERTISEMENTS PANEL -->
        <section data-tab-panel="ads" hidden>
          <div class="split-grid">
            <div class="panel">
              <div class="panel-head"><h2 style="font-size:1.05rem;">Manage Advertisement Campaign</h2></div>
              <form id="adForm" class="panel-body">
                <input type="hidden" id="adEditId">
                <input type="hidden" id="adImageUrl">
                <div class="form-group">
                  <label for="adTitle" class="form-label">Campaign Headline</label>
                  <input id="adTitle" type="text" required minlength="3" class="input" placeholder="e.g., LASU Postgraduate Admissions 2026/2027">
                </div>
                <div class="form-group">
                  <label for="adAdvertiser" class="form-label">Advertiser / Sponsor</label>
                  <input id="adAdvertiser" type="text" required minlength="2" class="input" placeholder="e.g., LASU Postgraduate School">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                  <div class="form-group">
                    <label for="adPlacement" class="form-label">Placement</label>
                    <select id="adPlacement" class="select">
                      <option value="sidebar_box">Sidebar Box</option>
                      <option value="top_banner">Top Leaderboard</option>
                      <option value="inline_banner">Inline Feed Banner</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="adStatus" class="form-label">Status</label>
                    <select id="adStatus" class="select">
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="adTargetUrl" class="form-label">Destination URL (optional)</label>
                  <input id="adTargetUrl" type="url" class="input" placeholder="https://lasu.edu.ng">
                </div>
                <div class="form-group" style="padding:0.75rem;background:var(--lasu-paper);border:1px solid var(--lasu-border);">
                  <label for="adImageFile" class="form-label">Banner Image Upload (optional)</label>
                  <input id="adImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
                  <div id="adImagePreviewWrap" style="margin-top:0.5rem;display:flex;align-items:center;gap:0.75rem;" hidden>
                    <img id="adImagePreview" src="" alt="Ad Preview" style="width:96px;height:54px;object-fit:cover;border:1px solid var(--lasu-border);">
                    <button type="button" id="removeAdImageBtn" class="btn btn-danger">Remove</button>
                  </div>
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button type="submit" id="adSubmitBtn" class="btn btn-primary">Create Campaign</button>
                  <button type="button" id="adCancelBtn" class="btn btn-outline" hidden>Cancel</button>
                </div>
              </form>
            </div>

            <div class="panel">
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>Campaign</th><th>Placement</th><th>Status</th><th style="text-align:right;">Impr.</th><th style="text-align:right;">Clicks</th><th style="text-align:right;">Actions</th></tr>
                  </thead>
                  <tbody id="adsTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- READER USER ACCOUNTS PANEL (FULL CRUD) -->
        <section data-tab-panel="users" hidden>
          <div class="split-grid">
            <div class="panel">
              <div class="panel-head"><h2 id="readerFormTitle" style="font-size:1.05rem;">Create Reader Account</h2></div>
              <form id="readerForm" class="panel-body">
                <input type="hidden" id="readerEditId">
                <div class="form-group">
                  <label for="readerName" class="form-label">Full Name</label>
                  <input id="readerName" type="text" required minlength="2" maxlength="100" class="input" placeholder="e.g., Tunde Adeyemi">
                </div>
                <div class="form-group">
                  <label for="readerEmail" class="form-label">Email Address</label>
                  <input id="readerEmail" type="email" required class="input" placeholder="student@lasu.edu.ng">
                </div>
                <div class="form-group">
                  <label for="readerDept" class="form-label">Department / Faculty</label>
                  <input id="readerDept" type="text" maxlength="120" class="input" placeholder="e.g., Faculty of Law">
                </div>
                <div class="form-group">
                  <label for="readerPassword" id="readerPassLabel" class="form-label">Password (min 6 chars)</label>
                  <input id="readerPassword" type="password" required minlength="6" class="input" placeholder="Minimum 6 characters">
                </div>
                <div class="form-group">
                  <label style="font-size:0.8rem;"><input type="checkbox" id="readerActive" checked> Account Active</label>
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button type="submit" id="readerSubmitBtn" class="btn btn-primary">Create Reader</button>
                  <button type="button" id="readerCancelBtn" class="btn btn-outline" hidden>Cancel</button>
                </div>
              </form>
            </div>

            <div class="panel">
              <div class="panel-head" style="flex-wrap:wrap;gap:0.75rem;">
                <div>
                  <h2 style="font-size:1.05rem;">Registered Campus Reader Accounts</h2>
                  <span id="usersCountLabel" class="font-mono" style="font-size:0.75rem;color:var(--lasu-muted);">0 accounts</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                  <input id="filterUserSearch" type="search" class="input" style="width:190px;" placeholder="Search name, email, dept...">
                  <select id="filterUserStatus" class="select" style="width:auto;">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>Reader</th><th>Department</th><th>Status</th><th style="text-align:right;">Comments</th><th>Joined</th><th style="text-align:right;">Actions</th></tr>
                  </thead>
                  <tbody id="usersTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- ADMINISTRATORS PANEL -->
        <section data-tab-panel="admins" hidden>
          <div class="split-grid">
            <div class="panel">
              <div class="panel-head"><h2 id="adminFormTitle" style="font-size:1.05rem;">Add Administrator</h2></div>
              <div class="panel-body">
                <?php if ($admin['role'] !== 'super_admin'): ?>
                  <p style="font-size:0.85rem;color:var(--lasu-muted);">Only Super Administrators can create, edit, or remove administrator accounts.</p>
                <?php else: ?>
                  <form id="createAdminForm">
                    <input type="hidden" id="adminEditId">
                    <div class="form-group">
                      <label for="newAdminName" class="form-label">Full Name</label>
                      <input id="newAdminName" type="text" required class="input" placeholder="e.g., Dr. Folake Adeyemi">
                    </div>
                    <div class="form-group">
                      <label for="newAdminEmail" class="form-label">University Email</label>
                      <input id="newAdminEmail" type="email" required class="input" placeholder="editor@lasu.edu.ng">
                    </div>
                    <div class="form-group">
                      <label for="newAdminPassword" id="newAdminPassLabel" class="form-label">Password (min 8 chars)</label>
                      <input id="newAdminPassword" type="password" required minlength="8" class="input" placeholder="Minimum 8 characters">
                    </div>
                    <div class="form-group">
                      <label for="newAdminRole" class="form-label">Role</label>
                      <select id="newAdminRole" class="select">
                        <option value="editor">Editor</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                    <div id="newAdminActiveWrap" class="form-group" hidden>
                      <label style="font-size:0.8rem;"><input type="checkbox" id="newAdminActive" checked> Account Active</label>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                      <button type="submit" id="newAdminSubmitBtn" class="btn btn-primary">Create Administrator</button>
                      <button type="button" id="newAdminCancelBtn" class="btn btn-outline" hidden>Cancel</button>
                    </div>
                  </form>
                <?php endif; ?>
              </div>
            </div>

            <div class="panel">
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Administrator</th><th>Role</th><th>Status</th><th style="text-align:right;">Articles</th>
                      <?php if ($admin['role'] === 'super_admin'): ?><th style="text-align:right;">Actions</th><?php endif; ?>
                    </tr>
                  </thead>
                  <tbody id="adminsTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- ACTIVITY LOG PANEL -->
        <section data-tab-panel="activity" hidden>
          <div class="panel">
            <div class="panel-head"><h2 style="font-size:1.05rem;">Publishing Activity Log</h2></div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Timestamp</th><th>Administrator</th><th>Action</th><th>Details</th></tr>
                </thead>
                <tbody id="fullActivityBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- PRESS INQUIRIES PANEL -->
        <section data-tab-panel="messages" hidden>
          <div class="panel">
            <div class="panel-head"><h2 style="font-size:1.05rem;">Contact &amp; Press Desk Submissions</h2></div>
            <div id="messagesContainer"></div>
          </div>
        </section>
      </main>
    </div>
  </div>

  <!-- Article Composer Modal -->
  <div id="articleModal" class="modal-backdrop" hidden>
    <div class="modal-card">
      <div class="panel-head">
        <h2 id="artModalTitle" style="font-size:1.25rem;">Compose Campus Broadcast</h2>
        <button type="button" id="closeArticleModalBtn" style="background:none;border:none;font-size:1.5rem;cursor:pointer;" aria-label="Close">&times;</button>
      </div>
      <form id="articleForm" class="panel-body">
        <input type="hidden" id="artId">
        <input type="hidden" id="artImageUrl">

        <div class="form-group">
          <label for="artTitle" class="form-label">Headline</label>
          <input id="artTitle" type="text" required minlength="5" class="input" placeholder="Enter full broadcast headline...">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label for="artCategoryId" class="form-label">Category</label>
              <button type="button" id="reloadArtCatsBtn" style="background:none;border:none;color:var(--lasu-navy);font-size:0.72rem;font-weight:600;cursor:pointer;padding:0;" hidden>Reload</button>
            </div>
            <select id="artCategoryId" class="select" required>
              <option value="">Loading categories...</option>
            </select>
          </div>
          <div class="form-group">
            <label for="artStatus" class="form-label">Status</label>
            <select id="artStatus" class="select">
              <option value="published">Published (Live)</option>
              <option value="draft">Save as Draft</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="padding:0.9rem;background:var(--lasu-paper);border:1px solid var(--lasu-border);border-radius:0.375rem;">
          <label for="artImageFile" class="form-label">Featured Image Upload (JPEG, PNG, WEBP, GIF &mdash; max 5MB)</label>
          <input id="artImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
          <div id="artImagePreviewWrap" style="margin-top:0.75rem;display:flex;align-items:center;gap:1rem;" hidden>
            <img id="artImagePreview" src="" alt="Preview" style="width:110px;height:75px;object-fit:cover;border-radius:0.25rem;border:1px solid var(--lasu-border);">
            <button type="button" id="removeArtImageBtn" class="btn btn-danger">Remove Image</button>
          </div>
        </div>

        <div class="form-group">
          <label for="artExcerpt" class="form-label">Editorial Summary / Deck</label>
          <textarea id="artExcerpt" rows="2" required minlength="10" class="textarea" placeholder="Concise summary displayed on news cards..."></textarea>
        </div>

        <div class="form-group">
          <label for="artContent" class="form-label">Full Broadcast Content</label>
          <textarea id="artContent" rows="7" required minlength="20" class="textarea" placeholder="Write the complete dispatch..."></textarea>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:1.25rem;align-items:center;margin-bottom:1.25rem;">
          <label style="font-size:0.8rem;"><input type="checkbox" id="artFeatured"> Feature on Homepage</label>
          <label style="font-size:0.8rem;"><input type="checkbox" id="artBreaking"> Breaking News Ticker</label>
          <label style="font-size:0.8rem;"><input type="checkbox" id="artAnnouncement"> Official Announcement</label>
          <select id="artPriority" class="select" style="width:auto;">
            <option value="normal">Normal Priority</option>
            <option value="urgent">Urgent Circular</option>
          </select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--lasu-border);">
          <button type="button" id="cancelArticleModalBtn" class="btn btn-outline">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Broadcast</button>
        </div>
      </form>
    </div>
  </div>

  <script src="<?= e(url_for('/assets/js/admin.js')) ?>"></script>
</body>
</html>
