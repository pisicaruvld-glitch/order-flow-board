import { loadConfig } from './appConfig';

// ============================================================
// Types
// ============================================================
export type TaskStatus = 'OPEN' | 'WAITING_REPLY' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to_user_id?: number;
  assigned_to_username?: string;
  waiting_on_user_id?: number;
  waiting_on_username?: string;
  created_by_user_id?: number;
  created_by_username?: string;
  due_at?: string;
  entity_type?: string;
  entity_id?: string;
  order_id?: string;
  comment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id?: number;
  username?: string;
  message: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  task_id?: number;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

export interface InboxSummary {
  my_open_tasks: number;
  waiting_my_reply: number;
  unread_notifications: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigned_to_user_id: number;
  waiting_on_user_id?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_at?: string;
  entity_type?: string;
  entity_id?: string;
  order_id?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to_user_id?: number;
  waiting_on_user_id?: number;
  due_at?: string | null;
}

// ============================================================
// Fetch helper (reuses same pattern as rest of app)
// ============================================================
function apiBase() {
  return loadConfig().apiBaseUrl;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('vsro_auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { headers: authHeaders(), ...options });
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
// Tasks API
// ============================================================
export interface TaskFilters {
  mine?: boolean;
  waiting_reply?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  entity_type?: string;
  order_id?: string;
}

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.mine) params.set('mine', 'true');
  if (filters.waiting_reply) params.set('waiting_reply', 'true');
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.order_id) params.set('order_id', filters.order_id);
  const qs = params.toString();
  return apiFetch<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
}

export async function getTask(taskId: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`);
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(taskId: number, payload: UpdateTaskPayload): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ============================================================
// Task Comments
// ============================================================
export async function getTaskComments(taskId: number): Promise<TaskComment[]> {
  return apiFetch<TaskComment[]>(`/tasks/${taskId}/comments`);
}

export async function addTaskComment(taskId: number, message: string): Promise<TaskComment> {
  return apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ============================================================
// Notifications
// ============================================================
export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const qs = unreadOnly ? '?unread_only=true' : '';
  return apiFetch<Notification[]>(`/notifications${qs}`);
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiFetch<unknown>(`/notifications/${notificationId}/read`, { method: 'POST' });
}

// ============================================================
// Inbox Summary
// ============================================================
export async function getInboxSummary(): Promise<InboxSummary> {
  return apiFetch<InboxSummary>('/inbox/summary');
}
