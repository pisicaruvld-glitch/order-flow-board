import { fetchApiJson } from './http';

export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DelayStatus = 'ON_TIME' | 'OVERDUE' | 'DONE' | string;

export interface ActionItem {
  id: number;
  action: string;
  department?: string | null;
  responsible_user_id?: number | null;
  responsible_username?: string | null;
  due_date?: string | null;
  priority?: ActionPriority | null;
  status: ActionStatus;
  description?: string | null;
  delay_status?: DelayStatus | null;
  comments_count?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ActionComment {
  id: number;
  action_id: number;
  comment: string;
  created_by?: string | null;
  created_at?: string | null;
}

export interface ActionCreatePayload {
  action: string;
  department?: string | null;
  responsible_user_id?: number | null;
  due_date?: string | null;
  priority?: ActionPriority | null;
  status?: ActionStatus;
  description?: string | null;
}

export type ActionUpdatePayload = Partial<ActionCreatePayload>;

export interface ReminderResponse {
  mailto_url: string;
  subject?: string;
  body?: string;
  to?: string;
}

export async function listActions(params?: {
  department?: string;
  responsible_user_id?: number;
  status?: ActionStatus;
  overdue_only?: boolean;
  mine?: boolean;
}): Promise<ActionItem[]> {
  const qs = new URLSearchParams();
  if (params?.department) qs.set('department', params.department);
  if (params?.responsible_user_id != null) qs.set('responsible_user_id', String(params.responsible_user_id));
  if (params?.status) qs.set('status', params.status);
  if (params?.overdue_only) qs.set('overdue_only', 'true');
  if (params?.mine) qs.set('mine', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await fetchApiJson<ActionItem[] | { items: ActionItem[] }>(`/api/action-plan${suffix}`);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function createAction(payload: ActionCreatePayload): Promise<ActionItem> {
  return fetchApiJson<ActionItem>('/api/action-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAction(id: number, payload: ActionUpdatePayload): Promise<ActionItem> {
  return fetchApiJson<ActionItem>(`/api/action-plan/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getActionComments(id: number): Promise<ActionComment[]> {
  const data = await fetchApiJson<ActionComment[] | { comments: ActionComment[] }>(
    `/api/action-plan/${id}/comments`,
  );
  return Array.isArray(data) ? data : (data?.comments ?? []);
}

export async function addActionComment(id: number, comment: string): Promise<ActionComment> {
  return fetchApiJson<ActionComment>(`/api/action-plan/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function sendActionReminder(id: number): Promise<ReminderResponse> {
  return fetchApiJson<ReminderResponse>(`/api/action-plan/${id}/reminder`, {
    method: 'POST',
  });
}
