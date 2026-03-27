import { loadConfig } from "./appConfig";

function apiBase() {
  return loadConfig().apiBaseUrl;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem('vsro_auth_token');
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    let errorMsg = `API Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) errorMsg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* ignore */ }
    throw new Error(errorMsg);
  }
  return res.json();
}

// ============================================================
// Types
// ============================================================
export interface HistoryEvent {
  event_type: string;
  event_at: string;
  title: string;
  details?: Record<string, any>;
}

export interface UploadChange {
  uploaded_at: string;
  upload_id?: string;
  change_type: string;
  changed_fields: string[];
  before_values: Record<string, any>;
  after_values: Record<string, any>;
}

export interface FlowHistoryEntry {
  changed_at: string;
  from_area: string;
  to_area: string;
  from_label?: string;
  to_label?: string;
  action: string;
  changed_by: string;
  note?: string;
}

export interface HistoryTimelineEntry {
  upload_id?: string;
  uploaded_at?: string;
  version_label?: string;
  Start_date_sched: string;
  Scheduled_finish_date: string;
  Order_quantity: number;
  System_Status: string;
  User_Status?: string;
  Delivered_quantity?: number;
}

export interface HistoryIssue {
  id?: string;
  issue_code?: string;
  order_id?: string;
  pn?: string;
  issue_type?: string;
  comment?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  part_number?: string;
  finish_good_no?: string;
  finish_good_description?: string;
  Plant?: string;
  current_area?: string;
  current_label?: string;
  sap_area?: string;
  sap_effective_status?: string;
}

export interface HistoryIssueHistoryEntry {
  id?: string;
  issue_id?: string;
  action: string;
  changed_by: string;
  changed_at: string;
  details?: string;
}

export interface HistoryShipment {
  id: number;
  shipment_type?: string;
  order_id?: string;
  delivered_qty_delta?: number;
  scrap_qty_delta?: number;
  finished_qty_delta?: number;
  received_qty_delta?: number;
  shipped_qty_delta?: number;
  reported_at?: string;
  received_at?: string;
  shipped_at?: string;
  reported_by?: string;
  received_by?: string;
  shipped_by?: string;
  shipped_doc?: string;
}

export interface HistoryPallet {
  pallet_no: string;
  status?: string;
  qty_on_pallet?: number;
  created_at?: string;
  shipped_at?: string;
  created_by?: string;
  shipped_by?: string;
}

export interface OrderHistoryResponse {
  order_id: string;
  order: Record<string, any>;
  timeline: { entries: HistoryTimelineEntry[] };
  upload_changes: UploadChange[];
  flow_history: FlowHistoryEntry[];
  issues: HistoryIssue[];
  issue_history: HistoryIssueHistoryEntry[];
  production_status: Record<string, any> | null;
  logistics_status: Record<string, any> | null;
  shipments: HistoryShipment[];
  pallets: HistoryPallet[];
  events: HistoryEvent[];
}

export interface ComponentHistoryResponse {
  component_pn: string;
  occurrences: number;
  orders: string[];
  issues: HistoryIssue[];
  issue_history: HistoryIssueHistoryEntry[];
}

// ============================================================
// API calls
// ============================================================
export async function getOrderHistory(orderId: string): Promise<OrderHistoryResponse> {
  return apiFetch<OrderHistoryResponse>(`/history/orders/${encodeURIComponent(orderId)}`);
}

export async function getComponentHistory(componentPn: string): Promise<ComponentHistoryResponse> {
  return apiFetch<ComponentHistoryResponse>(`/history/components/${encodeURIComponent(componentPn)}`);
}
