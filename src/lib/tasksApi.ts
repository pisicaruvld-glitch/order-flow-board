import { fetchApiJson } from './http';

// ============================================================
// Types
// ============================================================
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REPLY' | 'DONE' | 'CANCELLED';
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
  open_created_by_me?: number;
}

export interface TaskHistoryEntry {
  id: number;
  task_id: number;
  action: string;
  changed_by_username?: string;
  details?: string;
  changed_at: string;
}

export interface WorkCenterData {
  summary: InboxSummary;
  my_tasks: any[];
  waiting_reply: any[];
  notifications: any[];
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
// Fetch helper
// ============================================================
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApiJson<T>(path, options);
}

// ============================================================
// DTO Mappers
// ============================================================
function mapTask(raw: any): Task {
  return {
    ...raw,
    id: raw.id ?? raw.task_id,
  };
}

function mapComment(raw: any): TaskComment {
  return {
    id: raw.id ?? raw.comment_id,
    task_id: raw.task_id,
    user_id: raw.user_id ?? raw.created_by_user_id,
    username: raw.username ?? raw.created_by_username,
    message: raw.message ?? raw.comment_text,
    created_at: raw.created_at,
  };
}

function mapNotification(raw: any): Notification {
  return {
    ...raw,
    id: raw.notification_id ?? raw.id,
  };
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
  const raw = await apiFetch<any[]>(`/tasks${qs ? `?${qs}` : ''}`);
  return raw.map(mapTask);
}

export async function getTask(taskId: number): Promise<Task> {
  const raw = await apiFetch<any>(`/tasks/${taskId}`);
  return mapTask(raw);
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const raw = await apiFetch<any>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapTask(raw);
}

export async function updateTask(taskId: number, payload: UpdateTaskPayload): Promise<Task> {
  const raw = await apiFetch<any>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapTask(raw);
}

// ============================================================
// Task Comments
// ============================================================
export async function getTaskComments(taskId: number): Promise<TaskComment[]> {
  const raw = await apiFetch<any[]>(`/tasks/${taskId}/comments`);
  return raw.map(mapComment);
}

export async function addTaskComment(taskId: number, text: string): Promise<TaskComment> {
  const raw = await apiFetch<any>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: text }),
  });
  return mapComment(raw);
}

// ============================================================
// Notifications
// ============================================================
export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const qs = unreadOnly ? '?unread_only=true' : '';
  const raw = await apiFetch<any[]>(`/notifications${qs}`);
  return raw.map(mapNotification);
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiFetch<unknown>(`/notifications/${notificationId}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<unknown>('/notifications/read-all', { method: 'POST' });
}

// ============================================================
// Inbox Summary
// ============================================================
export async function getInboxSummary(): Promise<InboxSummary> {
  return apiFetch<InboxSummary>('/inbox/summary');
}

// ============================================================
// Aggregated Work Center
// ============================================================
export async function getWorkCenter(): Promise<{ summary: InboxSummary; my_tasks: Task[]; waiting_reply: Task[]; notifications: Notification[] }> {
  const raw = await apiFetch<WorkCenterData>('/work-center');
  return {
    summary: raw.summary,
    my_tasks: (raw.my_tasks ?? []).map(mapTask),
    waiting_reply: (raw.waiting_reply ?? []).map(mapTask),
    notifications: (raw.notifications ?? []).map(mapNotification),
  };
}

// ============================================================
// Task History
// ============================================================
export async function getTaskHistory(taskId: number): Promise<TaskHistoryEntry[]> {
  const raw = await apiFetch<any[]>(`/tasks/${taskId}/history`);
  return raw.map(r => ({
    id: r.id ?? r.history_id,
    task_id: r.task_id,
    action: r.action ?? '',
    changed_by_username: r.changed_by_username ?? r.username,
    details: r.details,
    changed_at: r.changed_at ?? r.created_at,
  }));
}

// ============================================================
// Active Users (for task assignment)
// ============================================================
export interface ActiveUser {
  id: number;
  username: string;
  areas?: string[];
  role?: string;
}

export async function getActiveUsers(): Promise<ActiveUser[]> {
  return apiFetch<ActiveUser[]>('/users/active');
}
