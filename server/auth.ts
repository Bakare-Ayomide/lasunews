import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

export const SESSION_COOKIE_NAME = 'lasu_broadcast_sid';
export const USER_COOKIE_NAME = 'lasu_reader_sid';
const SESSION_TTL_HOURS = 12;

export interface AuthenticatedAdmin {
  id: number;
  full_name: string;
  email: string;
  role: 'super_admin' | 'editor';
  is_active: number;
}

export interface AuthenticatedUser {
  id: number;
  full_name: string;
  email: string;
  department: string;
  is_active: number;
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthenticatedAdmin;
  csrfToken?: string;
  sessionId?: string;
}

export function createAdminSession(adminId: number): { sessionId: string; csrfToken: string; expiresAt: string } {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expiresDate = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const expiresAt = expiresDate.toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(
    'INSERT INTO sessions (id, admin_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(sessionId, adminId, csrfToken, expiresAt);

  db.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").run(adminId);

  return { sessionId, csrfToken, expiresAt };
}

export function destroySession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function getSessionFromRequest(req: Request): {
  admin: AuthenticatedAdmin;
  csrfToken: string;
  sessionId: string;
} | null {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const sessionId = bearerToken || (typeof cookieToken === 'string' ? cookieToken : '');

  if (!sessionId) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
              a.id, a.full_name, a.email, a.role, a.is_active
       FROM sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .get(sessionId) as
    | {
        session_id: string;
        csrf_token: string;
        expires_at: string;
        id: number;
        full_name: string;
        email: string;
        role: 'super_admin' | 'editor';
        is_active: number;
      }
    | undefined;

  if (!row || row.is_active !== 1) {
    return null;
  }

  return {
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
    admin: {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
      is_active: row.is_active,
    },
  };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const headerToken = req.get('X-CSRF-Token') || req.body?._csrf;
    if (!headerToken || headerToken !== session.csrfToken) {
      res.status(403).json({ error: 'Invalid or missing CSRF security token.' });
      return;
    }
  }

  req.admin = session.admin;
  req.csrfToken = session.csrfToken;
  req.sessionId = session.sessionId;
  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.admin || req.admin.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Administrator privileges are required for this action.' });
    return;
  }
  next();
}

export function createUserSession(userId: number): string {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresDate.toISOString().replace('T', ' ').slice(0, 19);

  db.prepare('INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    sessionId,
    userId,
    expiresAt
  );
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
  return sessionId;
}

export function destroyUserSession(sessionId: string): void {
  db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId);
}

export function getUserFromRequest(req: Request): { user: AuthenticatedUser; sessionId: string } | null {
  const headerToken = req.get('x-reader-token') || '';
  const cookieToken = req.cookies?.[USER_COOKIE_NAME];
  const sessionId = headerToken.trim() || (typeof cookieToken === 'string' ? cookieToken : '');
  if (!sessionId) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT us.id AS session_id, u.id, u.full_name, u.email, u.department, u.is_active
       FROM user_sessions us
       INNER JOIN users u ON u.id = us.user_id
       WHERE us.id = ? AND us.expires_at > datetime('now')`
    )
    .get(sessionId) as
    | {
        session_id: string;
        id: number;
        full_name: string;
        email: string;
        department: string;
        is_active: number;
      }
    | undefined;

  if (!row || row.is_active !== 1) {
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      department: row.department,
      is_active: row.is_active,
    },
  };
}
