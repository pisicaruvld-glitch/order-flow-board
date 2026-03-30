import { loadConfig } from './appConfig';

// ============================================================
// Types
// ============================================================
export type ComplaintType =
  | 'MISSING_COMPONENTS'
  | 'WRONG_COMPONENT'
  | 'WRONG_QUANTITY'
  | 'WRONG_QTY'
  | 'WRONG_PART'
  | 'WRONG_LABELING'
  | 'DAMAGED_COMPONENTS'
  | 'QUALITY_PROBLEM'
  | 'LATE_PREPARATION'
  | 'OTHER';

export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'CLOSED';

export const COMPLAINT_TYPES: { value: ComplaintType; label: string }[] = [
  { value: 'MISSING_COMPONENTS', label: 'Missing Components' },
  { value: 'WRONG_QTY', label: 'Wrong Quantity' },
  { value: 'WRONG_PART', label: 'Wrong Part' },
  { value: 'WRONG_COMPONENT', label: 'Wrong Component' },
  { value: 'WRONG_LABELING', label: 'Wrong Labeling' },
  { value: 'DAMAGED_COMPONENTS', label: 'Damaged Components' },
  { value: 'QUALITY_PROBLEM', label: 'Quality Problem' },
  { value: 'LATE_PREPARATION', label: 'Late Preparation' },
  { value: 'OTHER', label: 'Other' },
];

export const COMPLAINT_SEVERITIES: { value: ComplaintSeverity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export interface Complaint {
  complaint_id: number;
  order_id: string;
  complaint_type: ComplaintType;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  comment: string;
  raised_by_user_id: number;
  raised_by_username?: string;
  finish_good_no?: string;
  finish_good_description?: string;
  current_area?: string;
  created_at: string;
  updated_at?: string;
}

export interface ComplaintHistoryEntry {
  id: number;
  complaint_id: number;
  action: string;
  changed_by: string;
  changed_at: string;
  details?: string;
}

export interface CreateComplaintPayload {
  raised_by_user_id: number;
  complaint_type: ComplaintType;
  severity: ComplaintSeverity;
  comment: string;
}

export interface PatchComplaintPayload {
  status: ComplaintStatus;
  comment?: string;
}

// ============================================================
// Helpers
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
// Complaint API
// ============================================================
export async function createComplaint(orderId: string, payload: CreateComplaintPayload): Promise<Complaint> {
  return apiFetch<Complaint>(`/orders/${orderId}/warehouse-complaints`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getWarehouseComplaints(): Promise<Complaint[]> {
  return apiFetch<Complaint[]>('/warehouse/complaints');
}

export async function patchComplaint(complaintId: number, payload: PatchComplaintPayload): Promise<Complaint> {
  return apiFetch<Complaint>(`/warehouse-complaints/${complaintId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getComplaintHistory(complaintId: number): Promise<ComplaintHistoryEntry[]> {
  return apiFetch<ComplaintHistoryEntry[]>(`/warehouse-complaints/${complaintId}/history`);
}

// ============================================================
// Warehouse Prepare API
// ============================================================
export interface WarehousePreparePayload {
  prepared_by_user_id: number;
  comment?: string;
}

export interface WarehousePrepareResult {
  order_id: string;
  prepared_by_user_id: number;
  prepared_by_username?: string;
  comment?: string;
  prepared_at?: string;
}

export async function warehousePrepare(orderId: string, payload: WarehousePreparePayload): Promise<WarehousePrepareResult> {
  return apiFetch<WarehousePrepareResult>(`/orders/${orderId}/warehouse-prepare`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getWarehousePrepareInfo(orderId: string): Promise<WarehousePrepareResult | null> {
  try {
    return await apiFetch<WarehousePrepareResult>(`/orders/${orderId}/warehouse-prepare`);
  } catch {
    return null;
  }
}
