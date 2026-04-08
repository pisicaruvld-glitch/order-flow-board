// ============================================================
// Auth API – always uses same-origin /api, never localStorage config
// ============================================================

const AUTH_API_BASE = '/api';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'basic';
  is_active: number;
  areas?: string[];
  last_login_at?: string;
  reset_required?: boolean;
}

export interface LoginPayload { username: string; password: string; }
export interface RegisterPayload { username: string; password: string; }
export interface ChangePasswordPayload { current_password: string; new_password: string; }
export interface ResetPasswordPayload { new_password: string; }

interface LoginResponse {
  ok?: boolean;
  access_token?: string;
  token?: string;
  token_type?: string;
  user?: AuthUser;
  current_user?: AuthUser;
}

// ============================================================
// Token storage
// ============================================================
const TOKEN_KEY = 'vsro_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================================
// Fetch with timeout + debug logging (always /api)
// ============================================================
function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  console.log(`[authApi] token ${token ? 'found' : 'not found'}`);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const AUTH_TIMEOUT_MS = 10_000;

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${AUTH_API_BASE}${path}`;
  const method = options?.method || 'GET';
  console.log(`[authApi] ${method} ${url}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: authHeaders(),
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timer);
    console.log(`[authApi] ${method} ${url} → ${res.status} ok=${res.ok}`);

    if (!res.ok) {
      let errorMsg = `API Error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) errorMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        else if (body?.message) errorMsg = body.message;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }
    return res.json();
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`[authApi] ${method} ${url} timed out after ${AUTH_TIMEOUT_MS}ms`);
      throw new Error('Request timeout – check API connection');
    }
    throw err;
  }
}

// ============================================================
// Auth API
// ============================================================
export async function login(payload: LoginPayload): Promise<{ token: string; user: AuthUser }> {
  const resp = await authFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const token = resp.access_token || resp.token;
  if (!token) {
    console.error('[authApi] login response missing token', resp);
    throw new Error('Login failed: no token received');
  }
  setStoredToken(token);
  console.log('[authApi] token stored');

  const user = resp.user || resp.current_user;
  if (!user) {
    console.error('[authApi] login response missing user', resp);
    throw new Error('Login failed: no user data received');
  }
  return { token, user };
}

export async function register(payload: RegisterPayload): Promise<unknown> {
  return authFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logout(): Promise<void> {
  try { await authFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearStoredToken();
}

export async function getMe(): Promise<AuthUser> {
  const resp = await authFetch<{ ok?: boolean; user?: AuthUser; current_user?: AuthUser; id?: number }>('/auth/me');
  const user = resp.user || resp.current_user || (resp.id ? resp as unknown as AuthUser : null);
  if (!user) {
    console.error('[authApi] /auth/me returned no user', resp);
    throw new Error('Session invalid');
  }
  console.log('[authApi] /auth/me resolved user:', user.username);
  return user;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<unknown> {
  return authFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
}

export async function adminResetPassword(userId: number, payload: ResetPasswordPayload): Promise<unknown> {
  return authFetch(`/admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify(payload) });
}
