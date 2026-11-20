import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'lasu_broadcast.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      color_hex TEXT NOT NULL DEFAULT '#0B2545',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('super_admin', 'editor')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      featured_image TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_breaking INTEGER NOT NULL DEFAULT 0,
      is_announcement INTEGER NOT NULL DEFAULT 0,
      announcement_priority TEXT NOT NULL DEFAULT 'normal' CHECK(announcement_priority IN ('normal', 'urgent')),
      views INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (author_id) REFERENCES admins(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS advertisements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      advertiser_name TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      target_url TEXT NOT NULL DEFAULT '',
      placement TEXT NOT NULL DEFAULT 'sidebar_box' CHECK(placement IN ('top_banner', 'sidebar_box', 'inline_banner')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      csrf_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migrations for existing SQLite files BEFORE creating indexes on new columns
  ensureColumn('categories', 'color_hex', "TEXT NOT NULL DEFAULT '#0B2545'");
  ensureColumn('articles', 'is_breaking', 'INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_status_pub ON articles(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(is_featured, status);
    CREATE INDEX IF NOT EXISTS idx_articles_breaking ON articles(is_breaking, status);
    CREATE INDEX IF NOT EXISTS idx_articles_announcement ON articles(is_announcement, status);
    CREATE INDEX IF NOT EXISTS idx_articles_views ON articles(views DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_article_status ON comments(article_id, status);
    CREATE INDEX IF NOT EXISTS idx_ads_placement_status ON advertisements(placement, status);
  `);

  const defaultColors: Record<string, string> = {
    'university-news': '#0B2545',
    'student-news': '#0F766E',
    'academic-updates': '#B45309',
    'events': '#6D28D9',
    'sports': '#15803D',
    'announcements': '#B91C1C',
  };

  // Seed default LASU news categories if empty (no fabricated articles, comments, or ads are seeded)
  const catCountRow = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number };
  if (catCountRow.count === 0) {
    const defaultCategories = [
      {
        name: 'University News',
        slug: 'university-news',
        description: 'Official senate decisions, management dispatches, and institutional developments across LASU campuses.',
        color_hex: '#0B2545',
      },
      {
        name: 'Student News',
        slug: 'student-news',
        description: 'Student Union updates, campus life, hostels, scholarships, and student initiatives.',
        color_hex: '#0F766E',
      },
      {
        name: 'Academic Updates',
        slug: 'academic-updates',
        description: 'Academic calendars, examination schedules, course registration, and faculty announcements.',
        color_hex: '#B45309',
      },
      {
        name: 'Events',
        slug: 'events',
        description: 'Convocations, inaugural lectures, conferences, symposia, and cultural programmes.',
        color_hex: '#6D28D9',
      },
      {
        name: 'Sports',
        slug: 'sports',
        description: 'NUGA games, inter-faculty tournaments, athletics, and LASU Blazers fixtures.',
        color_hex: '#15803D',
      },
      {
        name: 'Announcements',
        slug: 'announcements',
        description: 'Urgent circulars, registrar notices, and time-sensitive campus broadcasts.',
        color_hex: '#B91C1C',
      },
    ];

    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, description, color_hex) VALUES (?, ?, ?, ?)'
    );
    for (const cat of defaultCategories) {
      insertCat.run(cat.name, cat.slug, cat.description, cat.color_hex);
    }
  } else {
    // Ensure existing seeded categories have distinct colorful desk accents
    const updateColor = db.prepare('UPDATE categories SET color_hex = ? WHERE slug = ? AND color_hex = ?');
    for (const [slug, hex] of Object.entries(defaultColors)) {
      if (hex !== '#0B2545') {
        updateColor.run(hex, slug, '#0B2545');
      }
    }
  }

  // Seed initial super administrator account if no admins exist
  const adminCountRow = db.prepare('SELECT COUNT(*) AS count FROM admins').get() as { count: number };
  if (adminCountRow.count === 0) {
    const passwordHash = bcrypt.hashSync('LasuBroadcast2026!', 10);
    db.prepare(
      'INSERT INTO admins (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)'
    ).run('Directorate Chief Editor', 'admin@lasu.edu.ng', passwordHash, 'super_admin');
  }

  // Seed 30 real LASU news articles fetched from lasu.edu.ng if articles table is empty
  const articleCountRow = db.prepare('SELECT COUNT(*) AS count FROM articles').get() as { count: number };
  if (articleCountRow.count === 0) {
    const seedFilePath = path.resolve(process.cwd(), 'server', 'lasuNewsSeed.json');
    if (fs.existsSync(seedFilePath)) {
      const seedArticles = JSON.parse(fs.readFileSync(seedFilePath, 'utf-8')) as Array<{
        source_id: number;
        title: string;
        excerpt: string;
        content: string;
        featured_image: string;
        published_at: string;
        views: number;
        category_slug: string;
        is_featured: number;
        is_breaking: number;
        is_announcement: number;
        announcement_priority: 'normal' | 'urgent';
      }>;

      const defaultAdmin = db.prepare('SELECT id FROM admins ORDER BY id ASC LIMIT 1').get() as
        | { id: number }
        | undefined;
      const catRows = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>;
      const catMap = new Map(catRows.map((c) => [c.slug, c.id]));
      const fallbackCatId = catRows[0]?.id;

      if (defaultAdmin && fallbackCatId) {
        const insertArticle = db.prepare(
          `INSERT INTO articles (
             title, slug, excerpt, content, featured_image, category_id, author_id,
             status, is_featured, is_breaking, is_announcement, announcement_priority,
             views, published_at, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const item of seedArticles) {
          const catId = catMap.get(item.category_slug) ?? fallbackCatId;
          const slug = generateUniqueArticleSlug(item.title);
          insertArticle.run(
            item.title,
            slug,
            item.excerpt,
            item.content,
            item.featured_image || '',
            catId,
            defaultAdmin.id,
            item.is_featured ? 1 : 0,
            item.is_breaking ? 1 : 0,
            item.is_announcement ? 1 : 0,
            item.announcement_priority === 'urgent' ? 'urgent' : 'normal',
            Number(item.views || 0),
            item.published_at,
            item.published_at,
            item.published_at
          );
        }
      }
    }
  }

  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  db.prepare("DELETE FROM user_sessions WHERE expires_at <= datetime('now')").run();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

export function generateUniqueArticleSlug(title: string, excludeId?: number): string {
  const base = slugify(title).slice(0, 80);
  let candidate = base;
  let counter = 1;
  while (true) {
    const existing = excludeId
      ? db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').get(candidate, excludeId)
      : db.prepare('SELECT id FROM articles WHERE slug = ?').get(candidate);
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export function generateUniqueCategorySlug(name: string, excludeId?: number): string {
  const base = slugify(name).slice(0, 60);
  let candidate = base;
  let counter = 1;
  while (true) {
    const existing = excludeId
      ? db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(candidate, excludeId)
      : db.prepare('SELECT id FROM categories WHERE slug = ?').get(candidate);
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export function logActivity(
  adminId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details: string
): void {
  db.prepare(
    'INSERT INTO activity_logs (admin_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(adminId, action, entityType, entityId, details);
}
