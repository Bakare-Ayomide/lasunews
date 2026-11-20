function safeReadStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string | null): void {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage restrictions
  }
}

let csrfTokenStore: string | null = safeReadStorage('lasu_admin_csrf');
let adminTokenStore: string | null = safeReadStorage('lasu_admin_token');
let userTokenStore: string | null = safeReadStorage('lasu_reader_token');

export function setCsrfToken(token: string | null): void {
  csrfTokenStore = token;
  safeWriteStorage('lasu_admin_csrf', token);
}

export function getCsrfToken(): string | null {
  return csrfTokenStore;
}

export function setAdminSession(sessionToken: string | null, csrfToken: string | null): void {
  adminTokenStore = sessionToken;
  csrfTokenStore = csrfToken;
  safeWriteStorage('lasu_admin_token', sessionToken);
  safeWriteStorage('lasu_admin_csrf', csrfToken);
}

export function clearAdminSession(): void {
  adminTokenStore = null;
  csrfTokenStore = null;
  safeWriteStorage('lasu_admin_token', null);
  safeWriteStorage('lasu_admin_csrf', null);
}

export function setUserToken(token: string | null): void {
  userTokenStore = token;
  safeWriteStorage('lasu_reader_token', token);
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  if (adminTokenStore && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${adminTokenStore}`);
  }

  if (userTokenStore && !headers.has('X-Reader-Token')) {
    headers.set('X-Reader-Token', userTokenStore);
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfTokenStore) {
    headers.set('X-CSRF-Token', csrfTokenStore);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Unscheduled';
  const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function estimateReadTime(text: string | undefined): string {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}
