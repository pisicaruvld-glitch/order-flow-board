import { fetchApiJson } from "./http";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApiJson<T>(path, options);
}

// Types
export interface InventoryRequest {
  request_id: number;
  material: string;
  material_description?: string;
  plant?: string;
  sloc?: string;
  request_reason?: string;
  requested_by: string;
  requested_at: string;
  status: string;
  priority: string;
  entered_by?: string;
  updated_by?: string;
  sap_hbl: number;
  sap_production: number;
  physical_hbl: number;
  physical_production: number;
  qty_open_orders: number;
  diff_hbl: number;
  diff_production: number;
  diff_total: number;
  sap_adjusted: boolean;
  sap_adjusted_by?: string;
  sap_adjusted_at?: string;
  sap_adjustment_doc?: string;
  counted_by?: string;
  counted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  closed_by?: string;
  closed_at?: string;
  root_cause?: string;
  comment?: string;
  closure_comment?: string;
  updated_at: string;
  // Financial & approval fields
  unit_value_eur?: number;
  financial_impact_eur?: number;
  approval_required?: boolean;
  approval_status?: string;
  approval_requested_at?: string;
  approval_requested_by?: string;
  approver_user_id?: number;
  approver_username?: string;
  approval_comment?: string;
  approved_at?: string;
  approved_by?: string;
}

export interface InventoryHistoryEntry {
  history_id: number;
  request_id: number;
  action: string;
  changed_by?: string;
  details?: string;
  changed_at: string;
}

export interface CreateInventoryRequestPayload {
  material: string;
  material_description?: string;
  plant?: string;
  sloc?: string;
  request_reason?: string;
  priority?: string;
  comment?: string;
}

export interface UpdateInventoryRequestPayload {
  sap_hbl?: number;
  sap_production?: number;
  physical_hbl?: number;
  physical_production?: number;
  qty_open_orders?: number;
  comment?: string;
  root_cause?: string;
  unit_value_eur?: number;
}

export interface ApprovalPayload {
  decision: "APPROVE" | "REJECT";
  approval_comment?: string;
}

// API functions
const BASE = "/inventory/requests";

export async function getInventoryRequests(): Promise<InventoryRequest[]> {
  return apiFetch<InventoryRequest[]>(BASE);
}

export async function getInventoryRequest(id: number): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}`);
}

export async function createInventoryRequest(payload: CreateInventoryRequestPayload): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInventoryRequest(id: number, payload: UpdateInventoryRequestPayload): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function reviewInventoryRequest(id: number): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}/review`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function markSapAdjusted(id: number, data: { sap_adjustment_doc?: string }): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}/sap-adjusted`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function closeInventoryRequest(id: number, data: { closure_comment?: string }): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}/close`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getInventoryRequestHistory(id: number): Promise<InventoryHistoryEntry[]> {
  return apiFetch<InventoryHistoryEntry[]>(`${BASE}/${id}/history`);
}

export async function submitApprovalDecision(id: number, payload: ApprovalPayload): Promise<InventoryRequest> {
  return apiFetch<InventoryRequest>(`${BASE}/${id}/approval`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
