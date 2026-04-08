import { fetchApiJson } from './http';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApiJson<T>(path, options);
}

// ── Types ──

export interface ReceivingIssueType {
  id: number;
  type_code: string;
  type_label: string;
  sort_order: number;
  is_active: boolean;
}

export interface ReceivingSupplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ReceivingIssue {
  id: number;
  status: 'NEW' | 'REVIEWED' | 'CLOSED';
  problem_type_id: number;
  problem_type_label?: string;
  supplier_id: number;
  supplier_name?: string;
  sap_component_number?: string;
  po_number?: string;
  problem_description: string;
  proposed_resolution?: string;
  review_comment?: string;
  close_comment?: string;
  created_by_username?: string;
  reviewed_by_username?: string;
  assigned_to_username?: string;
  created_at: string;
  reviewed_at?: string;
  closed_at?: string;
}

export interface ReceivingIssueHistoryEntry {
  id: number;
  action: string;
  comment?: string;
  created_by?: string;
  created_at: string;
}

// ── Admin master data ──

export async function getReceivingIssueTypes(): Promise<ReceivingIssueType[]> {
  return apiFetch<ReceivingIssueType[]>('/admin/receiving-issue-types');
}

export async function saveReceivingIssueTypes(types: ReceivingIssueType[]): Promise<unknown> {
  return apiFetch('/admin/receiving-issue-types', {
    method: 'PUT',
    body: JSON.stringify(types),
  });
}

export async function getReceivingSuppliers(): Promise<ReceivingSupplier[]> {
  return apiFetch<ReceivingSupplier[]>('/admin/receiving-suppliers');
}

export async function saveReceivingSuppliers(suppliers: ReceivingSupplier[]): Promise<unknown> {
  return apiFetch('/admin/receiving-suppliers', {
    method: 'PUT',
    body: JSON.stringify(suppliers),
  });
}

// ── Issues CRUD ──

export interface ReceivingIssueFilters {
  status?: string;
  q?: string;
  supplier_id?: number;
  problem_type_id?: number;
  limit?: number;
}

export async function getReceivingIssues(filters: ReceivingIssueFilters = {}): Promise<ReceivingIssue[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  });
  const qs = params.toString();
  return apiFetch<ReceivingIssue[]>(`/receiving/issues${qs ? `?${qs}` : ''}`);
}

export interface CreateReceivingIssuePayload {
  problem_type_id: number;
  supplier_id: number;
  sap_component_number?: string;
  po_number?: string;
  problem_description: string;
  assigned_department?: string;
  assigned_to_user_id?: number;
}

export async function createReceivingIssue(payload: CreateReceivingIssuePayload): Promise<ReceivingIssue> {
  return apiFetch<ReceivingIssue>('/receiving/issues', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function reviewReceivingIssue(issueId: number, payload: { proposed_resolution: string; review_comment?: string }): Promise<unknown> {
  return apiFetch(`/receiving/issues/${issueId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function closeReceivingIssue(issueId: number, payload: { close_comment?: string }): Promise<unknown> {
  return apiFetch(`/receiving/issues/${issueId}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getReceivingIssueHistory(issueId: number): Promise<ReceivingIssueHistoryEntry[]> {
  return apiFetch<ReceivingIssueHistoryEntry[]>(`/receiving/issues/${issueId}/history`);
}
