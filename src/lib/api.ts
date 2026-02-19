import {
  Order,
  StatusMapping,
  Issue,
  IssueHistoryEntry,
  UploadResult,
  OrderChange,
  ProductionStatus,
  LogisticsStatus,
  IssueType,
  Area,
} from './types';
import {
  MOCK_ORDERS,
  MOCK_STATUS_MAPPINGS,
  MOCK_ISSUES,
  MOCK_ISSUE_HISTORY,
  MOCK_PRODUCTION_STATUS,
  MOCK_LOGISTICS_STATUS,
  MOCK_UPLOAD_RESULT,
  MOCK_CHANGE_REPORT,
} from './mockData';
import { loadConfig } from './appConfig';

// ============================================================
// In-memory mutable state for DEMO mode
// ============================================================
let _orders = [...MOCK_ORDERS];
let _statusMappings = [...MOCK_STATUS_MAPPINGS];
let _issues = [...MOCK_ISSUES];
let _issueHistory = [...MOCK_ISSUE_HISTORY];
let _productionStatus = { ...MOCK_PRODUCTION_STATUS };
let _logisticsStatus = { ...MOCK_LOGISTICS_STATUS };

function isDemo() {
  return loadConfig().mode === 'DEMO';
}

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
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

function makeDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ============================================================
// ORDERS API
// ============================================================
export interface OrderFilters {
  area?: Area;
  status?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  plant?: string;
}

export async function getOrders(filters: OrderFilters = {}): Promise<Order[]> {
  if (isDemo()) {
    let orders = [..._orders];
    if (filters.area) orders = orders.filter(o => o.current_area === filters.area);
    if (filters.status) orders = orders.filter(o => o.System_Status === filters.status);
    if (filters.plant) orders = orders.filter(o => o.Plant === filters.plant);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      orders = orders.filter(
        o =>
          o.Order.toLowerCase().includes(q) ||
          o.Material.toLowerCase().includes(q) ||
          o.Material_description.toLowerCase().includes(q)
      );
    }
    if (filters.date_from) orders = orders.filter(o => o.Start_date_sched >= filters.date_from!);
    if (filters.date_to) orders = orders.filter(o => o.Scheduled_finish_date <= filters.date_to!);
    return orders;
  }

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
  return apiFetch<Order[]>(`/orders?${params.toString()}`);
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  if (isDemo()) {
    return _orders.find(o => o.Order === orderId);
  }
  return apiFetch<Order>(`/orders/${orderId}`);
}

// ============================================================
// STATUS MAPPINGS API
// ============================================================
export async function getStatusMappings(): Promise<StatusMapping[]> {
  if (isDemo()) return [..._statusMappings];
  return apiFetch<StatusMapping[]>('/admin/status-mapping');
}

export async function updateStatusMappings(mappings: StatusMapping[]): Promise<StatusMapping[]> {
  if (isDemo()) {
    _statusMappings = mappings;
    // Recompute areas for all orders
    _orders = _orders.map(o => {
      const m = _statusMappings.find(s => s.system_status_value === o.System_Status && s.is_active);
      return { ...o, current_area: m ? m.mapped_area : o.current_area };
    });
    return [..._statusMappings];
  }
  return apiFetch<StatusMapping[]>('/admin/status-mapping', {
    method: 'PUT',
    body: JSON.stringify(mappings),
  });
}

// ============================================================
// UPLOAD API
// ============================================================
export async function uploadOrders(_file: File): Promise<UploadResult> {
  if (isDemo()) {
    await new Promise(r => setTimeout(r, 1500));
    return { ...MOCK_UPLOAD_RESULT };
  }
  const form = new FormData();
  form.append('file', _file);
  const res = await fetch(`${apiBase()}/uploads/orders`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function getChangeReport(_uploadId: string): Promise<OrderChange[]> {
  if (isDemo()) {
    await new Promise(r => setTimeout(r, 500));
    return [...MOCK_CHANGE_REPORT];
  }
  return apiFetch<OrderChange[]>(`/uploads/${_uploadId}/changes`);
}

// ============================================================
// ISSUES API
// ============================================================
export async function getIssues(orderId: string): Promise<Issue[]> {
  if (isDemo()) return _issues.filter(i => i.order_id === orderId);
  return apiFetch<Issue[]>(`/orders/${orderId}/issues`);
}

export async function createIssue(
  orderId: string,
  data: { pn: string; issue_type: IssueType; comment: string }
): Promise<Issue> {
  if (isDemo()) {
    const newIssue: Issue = {
      id: `ISS-${Date.now()}`,
      order_id: orderId,
      pn: data.pn,
      issue_type: data.issue_type,
      comment: data.comment,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'current_user',
    };
    _issues = [..._issues, newIssue];
    _issueHistory = [
      ..._issueHistory,
      {
        id: `H-${Date.now()}`,
        issue_id: newIssue.id,
        action: 'CREATED',
        changed_by: 'current_user',
        changed_at: new Date().toISOString(),
        details: 'Issue created.',
      },
    ];
    return newIssue;
  }
  return apiFetch<Issue>(`/orders/${orderId}/issues`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function patchIssue(
  issueId: string,
  data: { status?: 'OPEN' | 'CLOSED'; comment?: string }
): Promise<Issue> {
  if (isDemo()) {
    const idx = _issues.findIndex(i => i.id === issueId);
    if (idx === -1) throw new Error('Issue not found');
    const updated: Issue = {
      ..._issues[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    _issues = [..._issues.slice(0, idx), updated, ..._issues.slice(idx + 1)];
    const action = data.status === 'CLOSED' ? 'STATUS_CHANGE' : 'EDITED';
    const details = data.status === 'CLOSED'
      ? 'Status changed from OPEN to CLOSED.'
      : `Comment updated.`;
    _issueHistory = [
      ..._issueHistory,
      {
        id: `H-${Date.now()}`,
        issue_id: issueId,
        action,
        changed_by: 'current_user',
        changed_at: new Date().toISOString(),
        details,
      },
    ];
    return updated;
  }
  return apiFetch<Issue>(`/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getIssueHistory(issueId: string): Promise<IssueHistoryEntry[]> {
  if (isDemo()) return _issueHistory.filter(h => h.issue_id === issueId);
  return apiFetch<IssueHistoryEntry[]>(`/issues/${issueId}/history`);
}

// ============================================================
// PRODUCTION API
// ============================================================
export async function getProductionStatus(orderId: string): Promise<ProductionStatus | undefined> {
  if (isDemo()) return _productionStatus[orderId];
  return apiFetch<ProductionStatus>(`/orders/${orderId}/production-status`);
}

export async function updateProductionStatus(
  orderId: string,
  status: ProductionStatus['status']
): Promise<ProductionStatus> {
  const updated: ProductionStatus = {
    order_id: orderId,
    status,
    updated_at: new Date().toISOString(),
    updated_by: 'current_user',
  };
  if (isDemo()) {
    _productionStatus = { ..._productionStatus, [orderId]: updated };
    return updated;
  }
  return apiFetch<ProductionStatus>(`/orders/${orderId}/production-status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ============================================================
// LOGISTICS API
// ============================================================
export async function getLogisticsStatus(orderId: string): Promise<LogisticsStatus | undefined> {
  if (isDemo()) return _logisticsStatus[orderId];
  return apiFetch<LogisticsStatus>(`/orders/${orderId}/logistics-status`);
}

export async function updateLogisticsStatus(
  orderId: string,
  data: Partial<LogisticsStatus>
): Promise<LogisticsStatus> {
  const current = _logisticsStatus[orderId] || {
    order_id: orderId,
    received_from_production: false,
    delivered: false,
  };
  const updated: LogisticsStatus = {
    ...current,
    ...data,
    order_id: orderId,
  };
  if (isDemo()) {
    _logisticsStatus = { ..._logisticsStatus, [orderId]: updated };
    return updated;
  }
  return apiFetch<LogisticsStatus>(`/orders/${orderId}/logistics-status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================
// DEMO ONLY: Move order between areas
// ============================================================
export async function demoMoveOrder(orderId: string, targetArea: Area): Promise<Order> {
  const idx = _orders.findIndex(o => o.Order === orderId);
  if (idx === -1) throw new Error('Order not found');
  const updated = { ..._orders[idx], current_area: targetArea };
  _orders = [..._orders.slice(0, idx), updated, ..._orders.slice(idx + 1)];
  return updated;
}

// ============================================================
// Mark Order Ready (Warehouse)
// ============================================================
export async function markOrderReady(orderId: string): Promise<Order> {
  if (isDemo()) {
    return demoMoveOrder(orderId, 'Production');
  }
  return apiFetch<Order>(`/orders/${orderId}/mark-ready`, { method: 'POST' });
}

// ============================================================
// Summary helpers (client-side)
// ============================================================
export function getAreaCounts(orders: Order[], mappings: StatusMapping[]) {
  const result: Record<string, Record<string, number>> = {
    Orders: {},
    Warehouse: {},
    Production: {},
    Logistics: {},
  };
  orders.forEach(o => {
    const m = mappings.find(s => s.system_status_value === o.System_Status && s.is_active);
    const label = m ? m.mapped_label : o.System_Status;
    const area = o.current_area;
    result[area][label] = (result[area][label] || 0) + 1;
  });
  return result;
}

export function getUniquePlants(orders: Order[]): string[] {
  return [...new Set(orders.map(o => o.Plant))].sort();
}

export function resetDemoState() {
  _orders = [...MOCK_ORDERS];
  _statusMappings = [...MOCK_STATUS_MAPPINGS];
  _issues = [...MOCK_ISSUES];
  _issueHistory = [...MOCK_ISSUE_HISTORY];
  _productionStatus = { ...MOCK_PRODUCTION_STATUS };
  _logisticsStatus = { ...MOCK_LOGISTICS_STATUS };
}
