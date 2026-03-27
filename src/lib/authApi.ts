import { loadConfig } from './appConfig';

// ============================================================
// Types
// ============================================================
export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'basic';
  is_active: number;
  areas?: string[];
  last_login_at?: string;
  reset_required?: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ResetPasswordPayload {
  new_password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
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
// Helpers
// ============================================================
function apiBase() {
  return loadConfig().apiBaseUrl;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    headers: authHeaders(),
    ...options,
  });
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
}

// ============================================================
// Auth API
// ============================================================
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const resp = await authFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (resp.access_token) {
    setStoredToken(resp.access_token);
  }
  return resp;
}

export async function register(payload: RegisterPayload): Promise<unknown> {
  return authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  clearStoredToken();
}

export async function getMe(): Promise<AuthUser> {
  return authFetch<AuthUser>('/auth/me');
}

export async function changePassword(payload: ChangePasswordPayload): Promise<unknown> {
  return authFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminResetPassword(userId: number, payload: ResetPasswordPayload): Promise<unknown> {
  return authFetch(`/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
