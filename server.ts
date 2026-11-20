import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initializeDatabase,
  generateUniqueArticleSlug,
  generateUniqueCategorySlug,
  logActivity,
} from './server/db.ts';
import {
  SESSION_COOKIE_NAME,
  USER_COOKIE_NAME,
  createAdminSession,
  createUserSession,
  destroySession,
  destroyUserSession,
  getSessionFromRequest,
  getUserFromRequest,
  requireAdminAuth,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { fetchMultiSourceHeadlines } from './server/sources.ts';

function getSessionCookieOptions(req: express.Request, maxAge: number) {
  const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';
  return {
    httpOnly: true,
    sameSite: isHttps ? ('none' as const) : ('lax' as const),
    secure: isHttps,
    maxAge,
    path: '/',
  };
}

const VALID_AD_UNITS = ['none', 'seconds', 'minutes', 'hours', 'days', 'months'] as const;
type AdDurationUnit = (typeof VALID_AD_UNITS)[number];

function computeAdExpiry(durationValue: number | null | undefined, durationUnit: string): {
  duration_value: number | null;
  duration_unit: AdDurationUnit;
  expires_at: string | null;
} {
  const unit: AdDurationUnit = (VALID_AD_UNITS as readonly string[]).includes(durationUnit)
    ? (durationUnit as AdDurationUnit)
    : 'none';
  const rawVal = typeof durationValue === 'number' && Number.isFinite(durationValue) ? Math.floor(durationValue) : 0;
  const val = Math.max(0, Math.min(rawVal, 100000));

  if (unit === 'none' || val <= 0) {
    return { duration_value: null, duration_unit: 'none', expires_at: null };
  }

  const target = new Date();
  if (unit === 'seconds') target.setUTCSeconds(target.getUTCSeconds() + val);
  else if (unit === 'minutes') target.setUTCMinutes(target.getUTCMinutes() + val);
  else if (unit === 'hours') target.setUTCHours(target.getUTCHours() + val);
  else if (unit === 'days') target.setUTCDate(target.getUTCDate() + val);
  else if (unit === 'months') target.setUTCMonth(target.getUTCMonth() + val);

  const expiresAt = target.toISOString().replace('T', ' ').slice(0, 19);
  return { duration_value: val, duration_unit: unit, expires_at: expiresAt };
}

function parseSqliteUtcMs(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const parsed = Date.parse(ts.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed) ? null : parsed;
}

function enrichAdRow<T extends Record<string, unknown>>(ad: T): T & {
  expires_at_ms: number | null;
  is_expired: number;
  remaining_seconds: number | null;
} {
  const expMs = parseSqliteUtcMs(typeof ad.expires_at === 'string' ? ad.expires_at : null);
  const nowMs = Date.now();
  return {
    ...ad,
    expires_at_ms: expMs,
    is_expired: expMs !== null && expMs <= nowMs ? 1 : 0,
    remaining_seconds: expMs !== null ? Math.max(0, Math.floor((expMs - nowMs) / 1000)) : null,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initializeDatabase();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'articles');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    const ext = extMap[file.mimetype] || '.jpg';
    const uniqueName = `lasu_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF image files are allowed.'));
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), 'uploads'), {
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    })
  );

  // ==========================================
  // PUBLIC API ENDPOINTS
  // ==========================================

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/public/categories', (_req, res) => {
    const categories = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.color_hex,
                COUNT(CASE WHEN a.status = 'published' THEN 1 END) AS published_count
         FROM categories c
         LEFT JOIN articles a ON a.category_id = c.id
         GROUP BY c.id
         ORDER BY c.name ASC`
      )
      .all();
    res.json({ categories });
  });

  app.get('/api/public/home', (_req, res) => {
    const baseSelect = `
      SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
             a.is_featured, a.is_breaking, a.is_announcement, a.announcement_priority,
             a.views, a.published_at, a.created_at,
             c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
             ad.full_name AS author_name
      FROM articles a
      INNER JOIN categories c ON c.id = a.category_id
      INNER JOIN admins ad ON ad.id = a.author_id
      WHERE a.status = 'published'
    `;

    const featured = db
      .prepare(`${baseSelect} AND a.is_featured = 1 ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 5`)
      .all();

    const breaking = db
      .prepare(
        `${baseSelect} AND (a.is_breaking = 1 OR (a.is_announcement = 1 AND a.announcement_priority = 'urgent'))
         ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 8`
      )
      .all();

    const latest = db
      .prepare(`${baseSelect} ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 8`)
      .all();

    const trending = db
      .prepare(`${baseSelect} ORDER BY a.views DESC, COALESCE(a.published_at, a.created_at) DESC LIMIT 5`)
      .all();

    const announcements = db
      .prepare(
        `${baseSelect} AND a.is_announcement = 1
         ORDER BY CASE WHEN a.announcement_priority = 'urgent' THEN 0 ELSE 1 END,
                  COALESCE(a.published_at, a.created_at) DESC
         LIMIT 6`
      )
      .all();

    const categories = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.color_hex,
                COUNT(CASE WHEN a.status = 'published' THEN 1 END) AS published_count
         FROM categories c
         LEFT JOIN articles a ON a.category_id = c.id
         GROUP BY c.id
         ORDER BY c.id ASC`
      )
      .all() as Array<{ id: number; name: string; slug: string; description: string; color_hex: string; published_count: number }>;

    const categorySections = categories.map((cat) => {
      const items = db
        .prepare(`${baseSelect} AND a.category_id = ? ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 3`)
        .all(cat.id);
      return {
        category: cat,
        articles: items,
      };
    });

    const ads = (
      db
        .prepare(
          `SELECT * FROM advertisements
           WHERE status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))
           ORDER BY display_order ASC, created_at DESC, id DESC`
        )
        .all() as Array<Record<string, unknown> & { id: number; placement: string }>
    ).map((ad) => enrichAdRow(ad));

    if (ads.length > 0) {
      const incAd = db.prepare('UPDATE advertisements SET impressions = impressions + 1 WHERE id = ?');
      for (const ad of ads) {
        incAd.run(ad.id);
      }
    }

    const stats = db
      .prepare(
        `SELECT
           COUNT(CASE WHEN status = 'published' THEN 1 END) AS total_published,
           COUNT(CASE WHEN status = 'published' AND is_announcement = 1 THEN 1 END) AS total_announcements,
           COALESCE(SUM(CASE WHEN status = 'published' THEN views ELSE 0 END), 0) AS total_views
         FROM articles`
      )
      .get() as { total_published: number; total_announcements: number; total_views: number };

    const commentStats = db
      .prepare("SELECT COUNT(*) AS approved_comments FROM comments WHERE status = 'approved'")
      .get() as { approved_comments: number };

    res.json({
      featured,
      breaking,
      latest,
      trending,
      announcements,
      categories,
      categorySections,
      ads,
      stats: {
        total_published: stats.total_published,
        total_announcements: stats.total_announcements,
        total_views: stats.total_views,
        total_categories: categories.length,
        approved_comments: commentStats.approved_comments,
      },
    });
  });

  app.get('/api/public/ads/:id/click', (req, res) => {
    const id = Number(req.params.id);
    const ad = db
      .prepare(
        `SELECT id, target_url FROM advertisements
         WHERE id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))`
      )
      .get(id) as { id: number; target_url: string } | undefined;

    if (!ad) {
      res.redirect('/');
      return;
    }

    db.prepare('UPDATE advertisements SET clicks = clicks + 1 WHERE id = ?').run(id);
    const safeUrl = /^https?:\/\//i.test(ad.target_url) ? ad.target_url : '/';
    res.redirect(safeUrl);
  });

  app.get('/api/public/articles', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : 'all';
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'latest';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(String(req.query.limit || '9'), 10) || 9));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["a.status = 'published'"];
    const params: Array<string | number> = [];

    if (q) {
      conditions.push('(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ? OR c.name LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    if (category && category !== 'all') {
      conditions.push('c.slug = ?');
      params.push(category);
    }

    if (type === 'announcement') {
      conditions.push('a.is_announcement = 1');
    } else if (type === 'featured') {
      conditions.push('a.is_featured = 1');
    } else if (type === 'breaking') {
      conditions.push('a.is_breaking = 1');
    }

    const whereClause = conditions.join(' AND ');
    const orderClause =
      sort === 'trending'
        ? 'a.views DESC, COALESCE(a.published_at, a.created_at) DESC'
        : 'COALESCE(a.published_at, a.created_at) DESC';

    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         WHERE ${whereClause}`
      )
      .get(...params) as { total: number };

    const articles = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
                a.is_featured, a.is_breaking, a.is_announcement, a.announcement_priority,
                a.views, a.published_at, a.created_at,
                c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
                ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json({
      articles,
      pagination: {
        page,
        limit,
        total: countRow.total,
        total_pages: Math.max(1, Math.ceil(countRow.total / limit)),
      },
    });
  });

  app.get('/api/public/articles/:slug', (req, res) => {
    const { slug } = req.params;
    const article = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.excerpt, a.content, a.featured_image,
                a.category_id, a.is_featured, a.is_breaking, a.is_announcement, a.announcement_priority,
                a.views, a.published_at, a.created_at, a.updated_at,
                c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
                ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.slug = ? AND a.status = 'published'`
      )
      .get(slug) as { id: number; category_id: number; views: number } | undefined;

    if (!article) {
      res.status(404).json({ error: 'Article not found or not currently published.' });
      return;
    }

    db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id);
    article.views += 1;

    const comments = db
      .prepare(
        `SELECT c.id, c.author_name, c.content, c.created_at, u.department
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.article_id = ? AND c.status = 'approved'
         ORDER BY c.created_at DESC`
      )
      .all(article.id);

    const related = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
                a.views, a.published_at, a.created_at,
                c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
                ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.status = 'published' AND a.id != ?
         ORDER BY CASE WHEN a.category_id = ? THEN 0 ELSE 1 END,
                  COALESCE(a.published_at, a.created_at) DESC
         LIMIT 3`
      )
      .all(article.id, article.category_id);

    const sidebarAds = (
      db
        .prepare(
          `SELECT * FROM advertisements
           WHERE status = 'active' AND placement = 'sidebar_box'
             AND (expires_at IS NULL OR expires_at > datetime('now'))
           ORDER BY display_order ASC, created_at DESC, id DESC`
        )
        .all() as Array<Record<string, unknown> & { id: number }>
    ).map((ad) => enrichAdRow(ad));

    if (sidebarAds.length > 0) {
      const incAd = db.prepare('UPDATE advertisements SET impressions = impressions + 1 WHERE id = ?');
      for (const ad of sidebarAds) incAd.run(ad.id);
    }

    res.json({ article, comments, related, sidebarAds });
  });

  app.post('/api/public/articles/:slug/comments', (req, res) => {
    const { slug } = req.params;
    const article = db
      .prepare("SELECT id, title FROM articles WHERE slug = ? AND status = 'published'")
      .get(slug) as { id: number; title: string } | undefined;

    if (!article) {
      res.status(404).json({ error: 'Published article not found.' });
      return;
    }

    const userSession = getUserFromRequest(req);
    const adminSession = getSessionFromRequest(req);

    const authorName = userSession
      ? userSession.user.full_name
      : adminSession
        ? adminSession.admin.full_name
        : typeof req.body.author_name === 'string'
          ? req.body.author_name.trim()
          : '';
    const authorEmail = userSession
      ? userSession.user.email
      : adminSession
        ? adminSession.admin.email
        : typeof req.body.author_email === 'string'
          ? req.body.author_email.trim().toLowerCase()
          : '';
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (authorName.length < 2 || authorName.length > 100) {
      res.status(400).json({ error: 'Please provide your full name (2–100 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (content.length < 3 || content.length > 2000) {
      res.status(400).json({ error: 'Comment must be between 3 and 2000 characters.' });
      return;
    }

    const status = adminSession ? 'approved' : 'pending';
    db.prepare(
      'INSERT INTO comments (article_id, user_id, author_name, author_email, content, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(article.id, userSession ? userSession.user.id : null, authorName, authorEmail, content, status);

    res.status(201).json({
      success: true,
      status,
      message:
        status === 'approved'
          ? 'Your comment has been published.'
          : 'Your comment has been submitted and is awaiting editorial moderation.',
    });
  });

  app.post('/api/public/contact', (req, res) => {
    const senderName = typeof req.body.sender_name === 'string' ? req.body.sender_name.trim() : '';
    const senderEmail = typeof req.body.sender_email === 'string' ? req.body.sender_email.trim() : '';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (senderName.length < 2 || senderName.length > 100) {
      res.status(400).json({ error: 'Please provide your full name (2–100 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (subject.length < 3 || subject.length > 160) {
      res.status(400).json({ error: 'Please enter a subject (3–160 characters).' });
      return;
    }
    if (message.length < 10 || message.length > 3000) {
      res.status(400).json({ error: 'Please enter a message (10–3000 characters).' });
      return;
    }

    db.prepare(
      'INSERT INTO contact_messages (sender_name, sender_email, subject, message) VALUES (?, ?, ?, ?)'
    ).run(senderName, senderEmail, subject, message);

    res.status(201).json({
      success: true,
      message: 'Your dispatch has been received by the LASU Broadcasting Directorate.',
    });
  });

  // ==========================================
  // PUBLIC USER ACCOUNT ENDPOINTS
  // ==========================================

  app.post('/api/users/register', (req, res) => {
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';

    if (fullName.length < 2 || fullName.length > 100) {
      res.status(400).json({ error: 'Full name must be 2–100 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    const existingAdmin = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
    if (existing || existingAdmin) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (full_name, email, password_hash, department, is_active) VALUES (?, ?, ?, ?, 1)')
      .run(fullName, email, hash, department.slice(0, 120));

    const userId = Number(result.lastInsertRowid);
    const sessionId = createUserSession(userId);

    res.cookie(USER_COOKIE_NAME, sessionId, getSessionCookieOptions(req, 7 * 24 * 60 * 60 * 1000));

    res.status(201).json({
      userToken: sessionId,
      user: {
        id: userId,
        full_name: fullName,
        email,
        department: department.slice(0, 120),
        is_active: 1,
      },
    });
  });

  app.post('/api/users/login', (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT id, full_name, email, password_hash, department, is_active FROM users WHERE email = ?')
      .get(email) as
      | { id: number; full_name: string; email: string; password_hash: string; department: string; is_active: number }
      | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.is_active !== 1) {
      res.status(403).json({ error: 'Your reader account has been suspended by an administrator.' });
      return;
    }

    const sessionId = createUserSession(user.id);
    res.cookie(USER_COOKIE_NAME, sessionId, getSessionCookieOptions(req, 7 * 24 * 60 * 60 * 1000));

    let adminPayload: {
      admin: { id: number; full_name: string; email: string; role: 'super_admin' | 'editor' };
      sessionToken: string;
      csrfToken: string;
    } | null = null;

    const matchedAdmin = db
      .prepare('SELECT id, full_name, email, password_hash, role, is_active FROM admins WHERE email = ?')
      .get(email) as
      | {
          id: number;
          full_name: string;
          email: string;
          password_hash: string;
          role: 'super_admin' | 'editor';
          is_active: number;
        }
      | undefined;

    if (matchedAdmin && matchedAdmin.is_active === 1 && bcrypt.compareSync(password, matchedAdmin.password_hash)) {
      const adminSess = createAdminSession(matchedAdmin.id);
      logActivity(matchedAdmin.id, 'login', 'admin', matchedAdmin.id, 'Signed in via Reader Account');
      res.cookie(SESSION_COOKIE_NAME, adminSess.sessionId, getSessionCookieOptions(req, 12 * 60 * 60 * 1000));
      adminPayload = {
        admin: {
          id: matchedAdmin.id,
          full_name: matchedAdmin.full_name,
          email: matchedAdmin.email,
          role: matchedAdmin.role,
        },
        sessionToken: adminSess.sessionId,
        csrfToken: adminSess.csrfToken,
      };
    }

    res.json({
      userToken: sessionId,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        department: user.department,
        is_active: user.is_active,
      },
      ...(adminPayload ? { adminAuth: adminPayload } : {}),
    });
  });

  app.post('/api/users/logout', (req, res) => {
    const session = getUserFromRequest(req);
    const adminSession = getSessionFromRequest(req);
    if (session && adminSession && session.user.email.toLowerCase() === adminSession.admin.email.toLowerCase()) {
      destroySession(adminSession.sessionId);
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(req, 0));
    }
    if (session) {
      destroyUserSession(session.sessionId);
    }
    res.clearCookie(USER_COOKIE_NAME, getSessionCookieOptions(req, 0));
    res.json({ success: true });
  });

  app.get('/api/users/me', (req, res) => {
    const session = getUserFromRequest(req);
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }

    const comments = db
      .prepare(
        `SELECT c.id, c.content, c.status, c.created_at, a.title AS article_title, a.slug AS article_slug
         FROM comments c
         INNER JOIN articles a ON a.id = c.article_id
         WHERE c.user_id = ?
         ORDER BY c.created_at DESC
         LIMIT 20`
      )
      .all(session.user.id);

    res.json({
      authenticated: true,
      userToken: session.sessionId,
      user: session.user,
      comments,
    });
  });

  // ==========================================
  // ADMIN AUTHENTICATION ENDPOINTS
  // ==========================================

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const admin = db
      .prepare('SELECT id, full_name, email, password_hash, role, is_active FROM admins WHERE email = ?')
      .get(email) as
      | {
          id: number;
          full_name: string;
          email: string;
          password_hash: string;
          role: 'super_admin' | 'editor';
          is_active: number;
        }
      | undefined;

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (admin.is_active !== 1) {
      res.status(403).json({ error: 'This administrator account has been deactivated.' });
      return;
    }

    const { sessionId, csrfToken } = createAdminSession(admin.id);
    logActivity(admin.id, 'login', 'admin', admin.id, `Signed in to LASU Broadcast Console`);

    res.cookie(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions(req, 12 * 60 * 60 * 1000));

    res.json({
      admin: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
      },
      sessionToken: sessionId,
      csrfToken,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const session = getSessionFromRequest(req);
    if (session) {
      destroySession(session.sessionId);
      logActivity(session.admin.id, 'logout', 'admin', session.admin.id, 'Signed out');
    }
    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(req, 0));
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = getSessionFromRequest(req);
    if (session) {
      res.json({
        authenticated: true,
        admin: session.admin,
        sessionToken: session.sessionId,
        csrfToken: session.csrfToken,
      });
      return;
    }

    const userSess = getUserFromRequest(req);
    if (userSess && userSess.user.is_active === 1) {
      const matchedAdmin = db
        .prepare('SELECT id, full_name, email, role, is_active FROM admins WHERE email = ?')
        .get(userSess.user.email.toLowerCase().trim()) as
        | {
            id: number;
            full_name: string;
            email: string;
            role: 'super_admin' | 'editor';
            is_active: number;
          }
        | undefined;

      if (matchedAdmin && matchedAdmin.is_active === 1 && (matchedAdmin.role === 'editor' || matchedAdmin.role === 'super_admin')) {
        const adminSess = createAdminSession(matchedAdmin.id);
        res.cookie(SESSION_COOKIE_NAME, adminSess.sessionId, getSessionCookieOptions(req, 12 * 60 * 60 * 1000));
        res.json({
          authenticated: true,
          admin: {
            id: matchedAdmin.id,
            full_name: matchedAdmin.full_name,
            email: matchedAdmin.email,
            role: matchedAdmin.role,
          },
          sessionToken: adminSess.sessionId,
          csrfToken: adminSess.csrfToken,
        });
        return;
      }
    }

    res.status(401).json({ authenticated: false });
  });

  // ==========================================
  // PROTECTED ADMIN ENDPOINTS
  // ==========================================

  app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
    const stats = db
      .prepare(
        `SELECT
           COUNT(*) AS total_articles,
           COUNT(CASE WHEN status = 'published' THEN 1 END) AS published_articles,
           COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_articles,
           COUNT(CASE WHEN is_announcement = 1 THEN 1 END) AS total_announcements,
           COUNT(CASE WHEN is_breaking = 1 AND status = 'published' THEN 1 END) AS breaking_articles,
           COUNT(CASE WHEN is_featured = 1 AND status = 'published' THEN 1 END) AS featured_articles,
           COALESCE(SUM(views), 0) AS total_views
         FROM articles`
      )
      .get();

    const categoryCount = db.prepare('SELECT COUNT(*) AS total_categories FROM categories').get() as {
      total_categories: number;
    };
    const adminCount = db.prepare('SELECT COUNT(*) AS active_admins FROM admins WHERE is_active = 1').get() as {
      active_admins: number;
    };
    const userCount = db.prepare('SELECT COUNT(*) AS total_users FROM users').get() as {
      total_users: number;
    };
    const pendingComments = db
      .prepare("SELECT COUNT(*) AS pending_comments FROM comments WHERE status = 'pending'")
      .get() as { pending_comments: number };
    const activeAds = db
      .prepare("SELECT COUNT(*) AS active_ads FROM advertisements WHERE status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))")
      .get() as { active_ads: number };
    const unreadMessages = db
      .prepare('SELECT COUNT(*) AS unread_messages FROM contact_messages WHERE is_read = 0')
      .get() as { unread_messages: number };

    const recentActivity = db
      .prepare(
        `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
                COALESCE(a.full_name, 'System') AS admin_name
         FROM activity_logs l
         LEFT JOIN admins a ON a.id = l.admin_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 12`
      )
      .all();

    const recentArticles = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.status, a.is_featured, a.is_breaking, a.is_announcement,
                a.views, a.published_at, a.updated_at,
                c.name AS category_name, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         ORDER BY a.updated_at DESC, a.id DESC
         LIMIT 6`
      )
      .all();

    res.json({
      stats: {
        ...(stats as Record<string, number>),
        total_categories: categoryCount.total_categories,
        active_admins: adminCount.active_admins,
        total_users: userCount.total_users,
        pending_comments: pendingComments.pending_comments,
        active_ads: activeAds.active_ads,
        unread_messages: unreadMessages.unread_messages,
      },
      recentActivity,
      recentArticles,
    });
  });

  app.post('/api/admin/upload', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Image upload failed.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Please select an image file to upload.' });
        return;
      }
      const url = `/uploads/articles/${req.file.filename}`;
      logActivity(req.admin!.id, 'upload', 'media', null, `Uploaded image ${req.file.filename}`);
      res.status(201).json({ url, filename: req.file.filename });
    });
  });

  app.get('/api/admin/articles', requireAdminAuth, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const categoryId = typeof req.query.category_id === 'string' ? req.query.category_id.trim() : 'all';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : 'all';

    const conditions: string[] = ['1=1'];
    const params: Array<string | number> = [];

    if (q) {
      conditions.push('(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (status === 'published' || status === 'draft') {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (categoryId !== 'all' && /^\d+$/.test(categoryId)) {
      conditions.push('a.category_id = ?');
      params.push(Number(categoryId));
    }
    if (type === 'announcement') {
      conditions.push('a.is_announcement = 1');
    } else if (type === 'featured') {
      conditions.push('a.is_featured = 1');
    } else if (type === 'breaking') {
      conditions.push('a.is_breaking = 1');
    } else if (type === 'news') {
      conditions.push('a.is_announcement = 0');
    }

    const articles = db
      .prepare(
        `SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.updated_at DESC, a.id DESC`
      )
      .all(...params);

    res.json({ articles });
  });

  const sanitizeArticleHtml = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (!/<(p|br|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|a|img|figure|hr|div)\b/i.test(trimmed)) {
      return trimmed;
    }
    return trimmed
      .replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*\/?>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '');
  };

  const stripHtmlText = (raw: string): string =>
    raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  app.post('/api/admin/articles', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const excerpt = typeof req.body.excerpt === 'string' ? req.body.excerpt.trim() : '';
    const content = typeof req.body.content === 'string' ? sanitizeArticleHtml(req.body.content) : '';
    const featuredImage = typeof req.body.featured_image === 'string' ? req.body.featured_image.trim() : '';
    const categoryId = Number(req.body.category_id);
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const isFeatured = req.body.is_featured ? 1 : 0;
    const isBreaking = req.body.is_breaking ? 1 : 0;
    const isAnnouncement = req.body.is_announcement ? 1 : 0;
    const announcementPriority = req.body.announcement_priority === 'urgent' ? 'urgent' : 'normal';

    if (title.length < 5 || title.length > 220) {
      res.status(400).json({ error: 'Article headline must be between 5 and 220 characters.' });
      return;
    }
    if (excerpt.length < 10 || excerpt.length > 500) {
      res.status(400).json({ error: 'Summary/excerpt must be between 10 and 500 characters.' });
      return;
    }
    if (stripHtmlText(content).length < 20) {
      res.status(400).json({ error: 'Article body content must be at least 20 characters of readable text.' });
      return;
    }

    const category = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(categoryId) as
      | { id: number; name: string }
      | undefined;
    if (!category) {
      res.status(400).json({ error: 'Please select a valid news category.' });
      return;
    }

    const slug = generateUniqueArticleSlug(title);
    const publishedAt = status === 'published' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null;

    const result = db
      .prepare(
        `INSERT INTO articles (
           title, slug, excerpt, content, featured_image, category_id, author_id,
           status, is_featured, is_breaking, is_announcement, announcement_priority, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        categoryId,
        req.admin!.id,
        status,
        isFeatured,
        isBreaking,
        isAnnouncement,
        announcementPriority,
        publishedAt
      );

    const newId = Number(result.lastInsertRowid);
    logActivity(
      req.admin!.id,
      status === 'published' ? 'publish' : 'create_draft',
      'article',
      newId,
      `${status === 'published' ? 'Published' : 'Saved draft'} "${title}" in ${category.name}`
    );

    const created = db
      .prepare(
        `SELECT a.*, c.name AS category_name, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.id = ?`
      )
      .get(newId);

    res.status(201).json({ article: created });
  });

  app.put('/api/admin/articles/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as
      | {
          id: number;
          title: string;
          status: string;
          published_at: string | null;
        }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const excerpt = typeof req.body.excerpt === 'string' ? req.body.excerpt.trim() : '';
    const content = typeof req.body.content === 'string' ? sanitizeArticleHtml(req.body.content) : '';
    const featuredImage = typeof req.body.featured_image === 'string' ? req.body.featured_image.trim() : '';
    const categoryId = Number(req.body.category_id);
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const isFeatured = req.body.is_featured ? 1 : 0;
    const isBreaking = req.body.is_breaking ? 1 : 0;
    const isAnnouncement = req.body.is_announcement ? 1 : 0;
    const announcementPriority = req.body.announcement_priority === 'urgent' ? 'urgent' : 'normal';

    if (title.length < 5 || title.length > 220) {
      res.status(400).json({ error: 'Article headline must be between 5 and 220 characters.' });
      return;
    }
    if (excerpt.length < 10 || excerpt.length > 500) {
      res.status(400).json({ error: 'Summary/excerpt must be between 10 and 500 characters.' });
      return;
    }
    if (stripHtmlText(content).length < 20) {
      res.status(400).json({ error: 'Article body content must be at least 20 characters of readable text.' });
      return;
    }

    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      res.status(400).json({ error: 'Please select a valid news category.' });
      return;
    }

    const slug = generateUniqueArticleSlug(title, id);
    let publishedAt = existing.published_at;
    if (status === 'published' && !publishedAt) {
      publishedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    db.prepare(
      `UPDATE articles SET
         title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?,
         category_id = ?, status = ?, is_featured = ?, is_breaking = ?, is_announcement = ?,
         announcement_priority = ?, published_at = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title,
      slug,
      excerpt,
      content,
      featuredImage,
      categoryId,
      status,
      isFeatured,
      isBreaking,
      isAnnouncement,
      announcementPriority,
      publishedAt,
      id
    );

    const actionVerb =
      existing.status !== 'published' && status === 'published'
        ? 'publish'
        : existing.status === 'published' && status === 'draft'
          ? 'unpublish'
          : 'update';

    logActivity(req.admin!.id, actionVerb, 'article', id, `Updated "${title}" (${status})`);

    const updated = db
      .prepare(
        `SELECT a.*, c.name AS category_name, ad.full_name AS author_name
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         WHERE a.id = ?`
      )
      .get(id);

    res.json({ article: updated });
  });

  app.delete('/api/admin/articles/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, title, featured_image FROM articles WHERE id = ?').get(id) as
      | { id: number; title: string; featured_image: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);

    if (existing.featured_image && existing.featured_image.startsWith('/uploads/articles/')) {
      const stillUsed = db
        .prepare('SELECT COUNT(*) AS count FROM articles WHERE featured_image = ?')
        .get(existing.featured_image) as { count: number };
      if (stillUsed.count === 0) {
        const filePath = path.resolve(process.cwd(), existing.featured_image.slice(1));
        if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    logActivity(req.admin!.id, 'delete', 'article', id, `Deleted article "${existing.title}"`);
    res.json({ success: true });
  });

  // Categories CRUD
  app.get('/api/admin/categories', requireAdminAuth, (_req, res) => {
    const categories = db
      .prepare(
        `SELECT c.*, COUNT(a.id) AS article_count,
                COUNT(CASE WHEN a.status = 'published' THEN 1 END) AS published_count
         FROM categories c
         LEFT JOIN articles a ON a.category_id = c.id
         GROUP BY c.id
         ORDER BY c.name ASC`
      )
      .all();
    res.json({ categories });
  });

  app.post('/api/admin/categories', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const colorHex = /^#[0-9A-Fa-f]{6}$/.test(String(req.body.color_hex || ''))
      ? String(req.body.color_hex)
      : '#0B2545';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Category name must be 2–80 characters.' });
      return;
    }

    const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
    if (dup) {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }

    const slug = generateUniqueCategorySlug(name);
    const result = db
      .prepare('INSERT INTO categories (name, slug, description, color_hex) VALUES (?, ?, ?, ?)')
      .run(name, slug, description, colorHex);

    const newId = Number(result.lastInsertRowid);
    logActivity(req.admin!.id, 'create', 'category', newId, `Created category "${name}"`);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(newId);
    res.status(201).json({ category });
  });

  app.put('/api/admin/categories/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const colorHex = /^#[0-9A-Fa-f]{6}$/.test(String(req.body.color_hex || ''))
      ? String(req.body.color_hex)
      : '#0B2545';

    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Category name must be 2–80 characters.' });
      return;
    }

    const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(name, id);
    if (dup) {
      res.status(409).json({ error: 'Another category already uses this name.' });
      return;
    }

    const slug = generateUniqueCategorySlug(name, id);
    db.prepare('UPDATE categories SET name = ?, slug = ?, description = ?, color_hex = ? WHERE id = ?').run(
      name,
      slug,
      description,
      colorHex,
      id
    );
    logActivity(req.admin!.id, 'update', 'category', id, `Updated category "${name}"`);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json({ category });
  });

  app.delete('/api/admin/categories/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id) as
      | { id: number; name: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const inUse = db.prepare('SELECT COUNT(*) AS count FROM articles WHERE category_id = ?').get(id) as {
      count: number;
    };
    if (inUse.count > 0) {
      res.status(409).json({
        error: `Cannot delete "${existing.name}" because ${inUse.count} article(s) are assigned to it.`,
      });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    logActivity(req.admin!.id, 'delete', 'category', id, `Deleted category "${existing.name}"`);
    res.json({ success: true });
  });

  // Comments Moderation
  app.get('/api/admin/comments', requireAdminAuth, (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const conditions = ['1=1'];
    const params: string[] = [];
    if (['pending', 'approved', 'rejected'].includes(status)) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    const comments = db
      .prepare(
        `SELECT c.*, a.title AS article_title, a.slug AS article_slug
         FROM comments c
         INNER JOIN articles a ON a.id = c.article_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, c.created_at DESC
         LIMIT 150`
      )
      .all(...params);
    res.json({ comments });
  });

  app.patch('/api/admin/comments/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) {
      res.status(400).json({ error: 'Invalid moderation status.' });
      return;
    }
    const existing = db.prepare('SELECT id, author_name FROM comments WHERE id = ?').get(id) as
      | { id: number; author_name: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
    logActivity(req.admin!.id, 'moderate', 'comment', id, `Marked comment by ${existing.author_name} as ${status}`);
    res.json({ success: true });
  });

  app.delete('/api/admin/comments/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM comments WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    logActivity(req.admin!.id, 'delete', 'comment', id, `Deleted comment #${id}`);
    res.json({ success: true });
  });

  // Full News Analytics & Performance Breakdown
  app.get('/api/admin/analytics', requireAdminAuth, (_req, res) => {
    const summary = db
      .prepare(
        `SELECT
           COUNT(*) AS total_articles,
           COUNT(CASE WHEN status = 'published' THEN 1 END) AS published_articles,
           COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_articles,
           COUNT(CASE WHEN is_featured = 1 AND status = 'published' THEN 1 END) AS featured_articles,
           COUNT(CASE WHEN is_breaking = 1 AND status = 'published' THEN 1 END) AS breaking_articles,
           COUNT(CASE WHEN is_announcement = 1 AND status = 'published' THEN 1 END) AS announcement_articles,
           COALESCE(SUM(views), 0) AS total_views,
           COALESCE(AVG(CASE WHEN status = 'published' THEN views END), 0) AS avg_views_published,
           COALESCE(MAX(views), 0) AS top_article_views
         FROM articles`
      )
      .get() as Record<string, number>;

    const commentSummary = db
      .prepare(
        `SELECT
           COUNT(*) AS total_comments,
           COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_comments,
           COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_comments,
           COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_comments
         FROM comments`
      )
      .get() as Record<string, number>;

    const adSummary = db
      .prepare(
        `SELECT
           COUNT(*) AS total_ads,
           COALESCE(SUM(impressions), 0) AS total_impressions,
           COALESCE(SUM(clicks), 0) AS total_clicks
         FROM advertisements`
      )
      .get() as Record<string, number>;

    const categoryBreakdown = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.color_hex,
                COUNT(a.id) AS total_articles,
                COUNT(CASE WHEN a.status = 'published' THEN 1 END) AS published_articles,
                COALESCE(SUM(a.views), 0) AS total_views,
                COALESCE(ROUND(AVG(CASE WHEN a.status = 'published' THEN a.views END), 1), 0) AS avg_views,
                (SELECT COUNT(*) FROM comments cm
                 INNER JOIN articles a2 ON a2.id = cm.article_id
                 WHERE a2.category_id = c.id) AS comment_count
         FROM categories c
         LEFT JOIN articles a ON a.category_id = c.id
         GROUP BY c.id
         ORDER BY total_views DESC, c.name ASC`
      )
      .all();

    const articlePerformance = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.status, a.views, a.is_featured, a.is_breaking,
                a.is_announcement, a.announcement_priority, a.published_at, a.created_at,
                c.id AS category_id, c.name AS category_name, c.color_hex AS category_color,
                ad.full_name AS author_name,
                COUNT(cm.id) AS total_comments,
                COUNT(CASE WHEN cm.status = 'approved' THEN 1 END) AS approved_comments
         FROM articles a
         INNER JOIN categories c ON c.id = a.category_id
         INNER JOIN admins ad ON ad.id = a.author_id
         LEFT JOIN comments cm ON cm.article_id = a.id
         GROUP BY a.id
         ORDER BY a.views DESC, COALESCE(a.published_at, a.created_at) DESC`
      )
      .all();

    res.json({
      summary: {
        ...summary,
        ...commentSummary,
        ...adSummary,
      },
      categoryBreakdown,
      articlePerformance,
    });
  });

  // External Multi-Source Headlines & Story Wire
  app.get('/api/admin/sources', requireAdminAuth, async (req, res) => {
    const sourceKey = typeof req.query.source === 'string' ? req.query.source.trim() : 'all';
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const customFeedUrl = typeof req.query.custom_url === 'string' ? req.query.custom_url.trim() : '';

    try {
      const data = await fetchMultiSourceHeadlines({ sourceKey, query, customFeedUrl });
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to fetch external news headlines.',
      });
    }
  });

  // Public Reader User Accounts Management (Full CRUD)
  app.get('/api/admin/users', requireAdminAuth, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const conditions: string[] = ['1=1'];
    const params: Array<string | number> = [];

    if (q) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (status === 'active') {
      conditions.push('u.is_active = 1');
    } else if (status === 'suspended') {
      conditions.push('u.is_active = 0');
    }

    const users = db
      .prepare(
        `SELECT u.id, u.full_name, u.email, u.department, u.is_active, u.last_login, u.created_at,
                COUNT(c.id) AS comment_count
         FROM users u
         LEFT JOIN comments c ON c.user_id = u.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      )
      .all(...params);
    res.json({ users });
  });

  app.post('/api/admin/users', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;

    if (fullName.length < 2 || fullName.length > 100) {
      res.status(400).json({ error: 'Full name must be 2–100 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const dup = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (dup) {
      res.status(409).json({ error: 'A reader account with this email already exists.' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (full_name, email, password_hash, department, is_active) VALUES (?, ?, ?, ?, ?)')
      .run(fullName, email, hash, department.slice(0, 120), isActive);

    const newId = Number(result.lastInsertRowid);
    logActivity(req.admin!.id, 'create', 'user', newId, `Created reader account ${email}`);
    const user = db
      .prepare('SELECT id, full_name, email, department, is_active, last_login, created_at FROM users WHERE id = ?')
      .get(newId);
    res.status(201).json({ user });
  });

  app.put('/api/admin/users/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as
      | { id: number; email: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Reader account not found.' });
      return;
    }

    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const newPassword = typeof req.body.password === 'string' ? req.body.password : '';
    const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;

    if (fullName.length < 2 || fullName.length > 100) {
      res.status(400).json({ error: 'Full name must be 2–100 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
    if (dup) {
      res.status(409).json({ error: 'Another reader account already uses this email.' });
      return;
    }

    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare(
        'UPDATE users SET full_name = ?, email = ?, department = ?, password_hash = ?, is_active = ? WHERE id = ?'
      ).run(fullName, email, department.slice(0, 120), hash, isActive, id);
    } else {
      db.prepare(
        'UPDATE users SET full_name = ?, email = ?, department = ?, is_active = ? WHERE id = ?'
      ).run(fullName, email, department.slice(0, 120), isActive, id);
    }

    if (isActive === 0) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    }

    logActivity(req.admin!.id, 'update', 'user', id, `Updated reader account ${email}`);
    const user = db
      .prepare('SELECT id, full_name, email, department, is_active, last_login, created_at FROM users WHERE id = ?')
      .get(id);
    res.json({ user });
  });

  app.patch('/api/admin/users/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const isActive = req.body.is_active ? 1 : 0;
    const existing = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as
      | { id: number; email: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, id);
    if (isActive === 0) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    }
    logActivity(
      req.admin!.id,
      'update',
      'user',
      id,
      `${isActive ? 'Activated' : 'Suspended'} reader account ${existing.email}`
    );
    res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as
      | { id: number; email: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logActivity(req.admin!.id, 'delete', 'user', id, `Deleted reader account ${existing.email}`);
    res.json({ success: true });
  });

  // Advertisement Management CRUD
  app.get('/api/admin/ads', requireAdminAuth, (_req, res) => {
    const ads = (
      db
        .prepare('SELECT * FROM advertisements ORDER BY placement ASC, display_order ASC, created_at DESC, id DESC')
        .all() as Array<Record<string, unknown>>
    ).map((ad) => enrichAdRow(ad));
    res.json({ ads });
  });

  app.post('/api/admin/ads', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const advertiserName = typeof req.body.advertiser_name === 'string' ? req.body.advertiser_name.trim() : '';
    const imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    const targetUrl = typeof req.body.target_url === 'string' ? req.body.target_url.trim() : '';
    const placement = ['top_banner', 'sidebar_box', 'inline_banner'].includes(req.body.placement)
      ? req.body.placement
      : 'sidebar_box';
    const status = req.body.status === 'paused' ? 'paused' : 'active';
    const displayOrder = Math.max(0, parseInt(String(req.body.display_order ?? '0'), 10) || 0);
    const durationUnit = typeof req.body.duration_unit === 'string' ? req.body.duration_unit : 'none';
    const durationValue =
      req.body.duration_value !== undefined && req.body.duration_value !== '' && req.body.duration_value !== null
        ? Math.max(0, parseInt(String(req.body.duration_value), 10) || 0)
        : 0;

    if (title.length < 3 || title.length > 160) {
      res.status(400).json({ error: 'Campaign title must be 3–160 characters.' });
      return;
    }
    if (advertiserName.length < 2 || advertiserName.length > 120) {
      res.status(400).json({ error: 'Advertiser name must be 2–120 characters.' });
      return;
    }
    if (targetUrl && !/^https?:\/\/.+/.test(targetUrl)) {
      res.status(400).json({ error: 'Target URL must begin with http:// or https://.' });
      return;
    }

    const dur = computeAdExpiry(durationValue, durationUnit);

    const result = db
      .prepare(
        `INSERT INTO advertisements (title, advertiser_name, image_url, target_url, placement, status, duration_value, duration_unit, expires_at, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        advertiserName,
        imageUrl,
        targetUrl,
        placement,
        status,
        dur.duration_value,
        dur.duration_unit,
        dur.expires_at,
        displayOrder
      );

    const newId = Number(result.lastInsertRowid);
    logActivity(req.admin!.id, 'create', 'advertisement', newId, `Created ad campaign "${title}" (${placement})`);
    const ad = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(newId) as Record<string, unknown>;
    res.status(201).json({ ad: enrichAdRow(ad) });
  });

  app.put('/api/admin/ads/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(id) as
      | {
          id: number;
          duration_value: number | null;
          duration_unit: string | null;
          expires_at: string | null;
          display_order: number | null;
        }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Advertisement not found.' });
      return;
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const advertiserName = typeof req.body.advertiser_name === 'string' ? req.body.advertiser_name.trim() : '';
    const imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    const targetUrl = typeof req.body.target_url === 'string' ? req.body.target_url.trim() : '';
    const placement = ['top_banner', 'sidebar_box', 'inline_banner'].includes(req.body.placement)
      ? req.body.placement
      : 'sidebar_box';
    const status = req.body.status === 'paused' ? 'paused' : 'active';
    const displayOrder = Math.max(
      0,
      parseInt(String(req.body.display_order ?? existing.display_order ?? '0'), 10) || 0
    );
    const durationUnit = typeof req.body.duration_unit === 'string' ? req.body.duration_unit : 'none';
    const durationValue =
      req.body.duration_value !== undefined && req.body.duration_value !== '' && req.body.duration_value !== null
        ? Math.max(0, parseInt(String(req.body.duration_value), 10) || 0)
        : 0;
    const restartDuration = Boolean(req.body.restart_duration);

    if (title.length < 3 || advertiserName.length < 2) {
      res.status(400).json({ error: 'Valid title and advertiser name are required.' });
      return;
    }
    if (targetUrl && !/^https?:\/\/.+/.test(targetUrl)) {
      res.status(400).json({ error: 'Target URL must begin with http:// or https://.' });
      return;
    }

    const prevVal = Number(existing.duration_value ?? 0);
    const prevUnit = existing.duration_unit || 'none';
    const durationChanged = durationUnit !== prevUnit || durationValue !== prevVal;

    let finalVal: number | null;
    let finalUnit: AdDurationUnit;
    let finalExpiresAt: string | null;

    if (durationUnit === 'none' || durationValue <= 0) {
      finalVal = null;
      finalUnit = 'none';
      finalExpiresAt = null;
    } else if (restartDuration || durationChanged) {
      const dur = computeAdExpiry(durationValue, durationUnit);
      finalVal = dur.duration_value;
      finalUnit = dur.duration_unit;
      finalExpiresAt = dur.expires_at;
    } else {
      finalVal = existing.duration_value;
      finalUnit = (VALID_AD_UNITS as readonly string[]).includes(prevUnit)
        ? (prevUnit as AdDurationUnit)
        : 'none';
      finalExpiresAt = existing.expires_at;
    }

    db.prepare(
      `UPDATE advertisements
       SET title = ?, advertiser_name = ?, image_url = ?, target_url = ?, placement = ?, status = ?,
           duration_value = ?, duration_unit = ?, expires_at = ?, display_order = ?
       WHERE id = ?`
    ).run(
      title,
      advertiserName,
      imageUrl,
      targetUrl,
      placement,
      status,
      finalVal,
      finalUnit,
      finalExpiresAt,
      displayOrder,
      id
    );

    logActivity(req.admin!.id, 'update', 'advertisement', id, `Updated ad campaign "${title}" (${status})`);
    const ad = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ ad: enrichAdRow(ad) });
  });

  app.delete('/api/admin/ads/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, title FROM advertisements WHERE id = ?').get(id) as
      | { id: number; title: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Advertisement not found.' });
      return;
    }
    db.prepare('DELETE FROM advertisements WHERE id = ?').run(id);
    logActivity(req.admin!.id, 'delete', 'advertisement', id, `Deleted ad campaign "${existing.title}"`);
    res.json({ success: true });
  });

  // Administrators CRUD
  app.get('/api/admin/admins', requireAdminAuth, (_req, res) => {
    const admins = db
      .prepare(
        `SELECT a.id, a.full_name, a.email, a.role, a.is_active, a.last_login, a.created_at,
                COUNT(art.id) AS article_count
         FROM admins a
         LEFT JOIN articles art ON art.author_id = a.id
         GROUP BY a.id
         ORDER BY a.created_at ASC`
      )
      .all();
    res.json({ admins });
  });

  app.post('/api/admin/admins', requireAdminAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role === 'super_admin' ? 'super_admin' : 'editor';

    if (fullName.length < 2 || fullName.length > 100) {
      res.status(400).json({ error: 'Full name must be 2–100 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const dup = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
    if (dup) {
      res.status(409).json({ error: 'An administrator account with this email already exists.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO admins (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)')
      .run(fullName, email, passwordHash, role);

    const newId = Number(result.lastInsertRowid);
    logActivity(req.admin!.id, 'create', 'admin', newId, `Created ${role} account for ${email}`);
    const admin = db
      .prepare('SELECT id, full_name, email, role, is_active, last_login, created_at FROM admins WHERE id = ?')
      .get(newId);
    res.status(201).json({ admin });
  });

  app.put('/api/admin/admins/:id', requireAdminAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, email, role, is_active FROM admins WHERE id = ?').get(id) as
      | { id: number; email: string; role: string; is_active: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Administrator account not found.' });
      return;
    }

    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const role = req.body.role === 'super_admin' ? 'super_admin' : 'editor';
    const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
    const newPassword = typeof req.body.password === 'string' ? req.body.password : '';

    if (id === req.admin!.id && isActive === 0) {
      res.status(400).json({ error: 'You cannot deactivate your own active administrator account.' });
      return;
    }

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }

    if (newPassword && newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE admins SET full_name = ?, role = ?, is_active = ?, password_hash = ? WHERE id = ?').run(
        fullName,
        role,
        isActive,
        hash,
        id
      );
    } else {
      db.prepare('UPDATE admins SET full_name = ?, role = ?, is_active = ? WHERE id = ?').run(
        fullName,
        role,
        isActive,
        id
      );
    }

    if (isActive === 0) {
      db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(id);
    }

    logActivity(req.admin!.id, 'update', 'admin', id, `Updated administrator ${existing.email}`);
    const admin = db
      .prepare('SELECT id, full_name, email, role, is_active, last_login, created_at FROM admins WHERE id = ?')
      .get(id);
    res.json({ admin });
  });

  app.delete('/api/admin/admins/:id', requireAdminAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    if (id === req.admin!.id) {
      res.status(400).json({ error: 'You cannot delete your own account while signed in.' });
      return;
    }

    const existing = db.prepare('SELECT id, email FROM admins WHERE id = ?').get(id) as
      | { id: number; email: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Administrator account not found.' });
      return;
    }

    const articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles WHERE author_id = ?').get(id) as {
      count: number;
    };
    if (articleCount.count > 0) {
      res.status(409).json({
        error: `Cannot delete ${existing.email} because they are the author of ${articleCount.count} article(s). Deactivate the account instead.`,
      });
      return;
    }

    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    logActivity(req.admin!.id, 'delete', 'admin', id, `Removed administrator ${existing.email}`);
    res.json({ success: true });
  });

  app.get('/api/admin/activity', requireAdminAuth, (_req, res) => {
    const logs = db
      .prepare(
        `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
                COALESCE(a.full_name, 'System') AS admin_name,
                COALESCE(a.email, '') AS admin_email
         FROM activity_logs l
         LEFT JOIN admins a ON a.id = l.admin_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 100`
      )
      .all();
    res.json({ logs });
  });

  app.get('/api/admin/messages', requireAdminAuth, (_req, res) => {
    const messages = db
      .prepare('SELECT * FROM contact_messages ORDER BY is_read ASC, created_at DESC LIMIT 100')
      .all();
    res.json({ messages });
  });

  app.patch('/api/admin/messages/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const isRead = req.body.is_read ? 1 : 0;
    const existing = db.prepare('SELECT id FROM contact_messages WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    db.prepare('UPDATE contact_messages SET is_read = ? WHERE id = ?').run(isRead, id);
    logActivity(req.admin!.id, 'update', 'contact_message', id, `Marked message #${id} as ${isRead ? 'read' : 'unread'}`);
    res.json({ success: true });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LASU Campus Broadcast preview server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
