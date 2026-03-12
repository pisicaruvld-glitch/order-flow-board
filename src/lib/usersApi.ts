import { loadConfig } from './appConfig';

// ============================================================
// Types
// ============================================================
export type UserArea = 'Orders' | 'Warehouse' | 'Production' | 'Logistics';

export interface OperationalUser {
  id: number;
  username: string;
  password_text?: string;
  is_active?: number;
  areas?: UserArea[];
  area?: UserArea;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserPayload {
  username: string;
  password_text: string;
  is_active: number;
  areas: UserArea[];
}

export interface UpdateUserPayload {
  username?: string;
  password_text?: string;
  is_active?: number;
  areas?: UserArea[];
}

// ============================================================
// Helpers
// ============================================================
function apiBase() {
  return loadConfig().apiBaseUrl;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
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
// Users CRUD
// ============================================================
export async function getUsers(): Promise<OperationalUser[]> {
  return apiFetch<OperationalUser[]>('/admin/users');
}

export async function createUser(payload: CreateUserPayload): Promise<OperationalUser> {
  return apiFetch<OperationalUser>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(userId: number, payload: UpdateUserPayload): Promise<OperationalUser> {
  return apiFetch<OperationalUser>(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ============================================================
// Delete User
// ============================================================
export async function deleteUser(userId: number): Promise<void> {
  await apiFetch<unknown>(`/admin/users/${userId}`, { method: 'DELETE' });
}

// ============================================================
// Users by Area
// ============================================================
export async function getUsersByArea(area: UserArea): Promise<OperationalUser[]> {
  return apiFetch<OperationalUser[]>(`/users/by-area?area=${encodeURIComponent(area)}`);
}
