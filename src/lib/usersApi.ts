import { fetchApiJson } from './http';

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
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApiJson<T>(path, options);
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
