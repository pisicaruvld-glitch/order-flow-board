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
  OrderTimeline,
  OrderTimelineEntry,
  AreaModes,
  DEFAULT_AREA_MODES,
  FlowMoveRequest,
  FlowMoveResult,
  FlowError,
  ErrorCategory,
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
import { loadConfig, AREA_MODES_KEY } from './appConfig';

// ============================================================
// In-memory mutable state for DEMO mode
// ============================================================
let _orders = [...MOCK_ORDERS];
let _statusMappings = [...MOCK_STATUS_MAPPINGS];
let _issues = [...MOCK_ISSUES];
let _issueHistory = [...MOCK_ISSUE_HISTORY];
let _productionStatus = { ...MOCK_PRODUCTION_STATUS };
let _logisticsStatus = { ...MOCK_LOGISTICS_STATUS };
// DEMO audit trail for manual moves
let _moveAuditTrail: Array<{ order_id: string; from: Area; to: Area; justification?: string; moved_at: string; moved_by: string }> = [];

function isDemo() {
  return loadConfig().mode === 'DEMO';
}

function cfg() {
  return loadConfig();
}

function apiBase() {
  return cfg().apiBaseUrl;
}

function ep() {
  return cfg().endpoints;
}

/** Replace path template variables like {order_id} */
function resolvePath(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (path, [k, v]) => path.replace(`{${k}}`, v),
    template
  );
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
      if (body?.detail) {
        errorMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      } else if (body?.message) {
        errorMsg = body.message;
      } else {
        errorMsg = `${errorMsg}: ${JSON.stringify(body)}`;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) errorMsg = `${errorMsg}: ${text}`;
      } catch { /* ignore */ }
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

// ============================================================
// HEALTH CHECK
// ============================================================
export async function checkHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const url = `${apiBase()}${ep().healthPath}`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      return { ok: true, message: `HTTP ${res.status} — Connection successful` };
    }
    return { ok: false, message: `HTTP ${res.status} — Server responded with error` };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
  }
}

// ============================================================
// EFFECTIVE STATUS LOGIC
// Parses "REL PRT PCNF" space-separated status string,
// picks the most advanced token by sort_order
// ============================================================
export function getEffectiveStatus(systemStatus: string, mappings: StatusMapping[]): StatusMapping | undefined {
  const tokens = systemStatus.trim().split(/\s+/).filter(Boolean);
  let best: StatusMapping | undefined;
  for (const token of tokens) {
    const m = mappings.find(s => s.system_status_value === token && s.is_active);
    if (m && (!best || m.sort_order > best.sort_order)) {
      best = m;
    }
  }
  return best;
}

export function deriveArea(systemStatus: string, mappings: StatusMapping[]): Area {
  const eff = getEffectiveStatus(systemStatus, mappings);
  return eff ? eff.mapped_area : 'Orders';
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
  return apiFetch<Order[]>(`${ep().ordersPath}?${params.toString()}`);
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  if (isDemo()) {
    return _orders.find(o => o.Order === orderId);
  }
  return apiFetch<Order>(`${ep().ordersPath}/${orderId}`);
}

// ============================================================
// STATUS MAPPINGS API
// ============================================================
export async function getStatusMappings(): Promise<StatusMapping[]> {
  if (isDemo()) return [..._statusMappings];
  return apiFetch<StatusMapping[]>(ep().statusMappingPath);
}

export async function updateStatusMappings(mappings: StatusMapping[]): Promise<StatusMapping[]> {
  if (isDemo()) {
    _statusMappings = mappings;
    // Recompute areas for all orders
    _orders = _orders.map(o => {
      const sapArea = deriveArea(o.System_Status, _statusMappings);
      const isManual = o.source === 'manual';
      const discrepancy = isManual && sapArea !== o.current_area;
      return {
        ...o,
        sap_area: sapArea,
        discrepancy,
        current_area: isManual ? o.current_area : sapArea,
      };
    });
    return [..._statusMappings];
  }
  return apiFetch<StatusMapping[]>(ep().statusMappingPath, {
    method: 'PUT',
    body: JSON.stringify(mappings),
  });
}

// ============================================================
// AREA MODES
// ============================================================
export async function getAreaModes(): Promise<AreaModes> {
  if (isDemo()) {
    try {
      const raw = localStorage.getItem(AREA_MODES_KEY);
      if (raw) return { ...DEFAULT_AREA_MODES, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_AREA_MODES };
  }
  try {
    const result = await apiFetch<{ value: AreaModes }>(ep().areaModesPath);
    return { ...DEFAULT_AREA_MODES, ...(result.value ?? result) };
  } catch {
    // Fallback to localStorage if endpoint missing
    try {
      const raw = localStorage.getItem(AREA_MODES_KEY);
      if (raw) return { ...DEFAULT_AREA_MODES, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_AREA_MODES };
  }
}

export async function saveAreaModes(modes: AreaModes): Promise<{ saved: boolean; local: boolean }> {
  // Always save locally as cache/fallback
  localStorage.setItem(AREA_MODES_KEY, JSON.stringify(modes));

  if (isDemo()) {
    return { saved: true, local: true };
  }

  try {
    await apiFetch(ep().areaModesPath, {
      method: 'PUT',
      body: JSON.stringify({ key: 'area_modes', value: modes }),
    });
    return { saved: true, local: false };
  } catch {
    // Backend missing — use local only
    return { saved: true, local: true };
  }
}

// ============================================================
// MANUAL MOVE (Next Step / Move Back)
// ============================================================
export async function moveOrder(req: FlowMoveRequest): Promise<FlowMoveResult> {
  if (isDemo()) {
    const idx = _orders.findIndex(o => o.Order === req.order_id);
    if (idx === -1) throw new Error('Order not found');
    const prev = _orders[idx];
    const sapArea = deriveArea(prev.System_Status, _statusMappings);
    const discrepancy = sapArea !== req.target_area;
    const result: FlowMoveResult = {
      order_id: req.order_id,
      previous_area: prev.current_area,
      current_area: req.target_area,
      source: 'manual',
      moved_at: new Date().toISOString(),
      moved_by: req.moved_by ?? 'current_user',
    };
    _orders = _orders.map((o, i) =>
      i === idx
        ? {
            ...o,
            current_area: req.target_area,
            source: 'manual',
            sap_area: sapArea,
            discrepancy,
          }
        : o
    );
    _moveAuditTrail = [
      ..._moveAuditTrail,
      {
        order_id: req.order_id,
        from: prev.current_area,
        to: req.target_area,
        justification: req.justification,
        moved_at: result.moved_at,
        moved_by: result.moved_by,
      },
    ];
    return result;
  }

  const path = resolvePath(ep().moveOrderPath, { order_id: req.order_id });
  return apiFetch<FlowMoveResult>(path, {
    method: 'POST',
    body: JSON.stringify({
      target_area: req.target_area,
      justification: req.justification,
    }),
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
  // Field name MUST be "file" — backend expects multipart/form-data with this key
  form.append('file', _file);
  const res = await fetch(`${apiBase()}${ep().uploadOrdersPath}`, {
    method: 'POST',
    // Do NOT set Content-Type header — browser sets it automatically with boundary
    body: form,
  });
  if (!res.ok) {
    // Try to extract backend error detail (FastAPI / standard REST)
    let errorMsg = `Upload failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        errorMsg = typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail);
      } else if (body?.message) {
        errorMsg = body.message;
      } else if (body?.error) {
        errorMsg = body.error;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) errorMsg = text;
      } catch { /* ignore */ }
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export async function getChangeReport(_uploadId: string): Promise<OrderChange[]> {
  if (isDemo()) {
    await new Promise(r => setTimeout(r, 500));
    return [...MOCK_CHANGE_REPORT];
  }
  return apiFetch<OrderChange[]>(`${ep().uploadOrdersPath}/${_uploadId}/changes`);
}

// ============================================================
// FLOW ERRORS (computed client-side from order data)
// ============================================================
export async function computeFlowErrors(
  orders: Order[],
  mappings: StatusMapping[],
): Promise<FlowError[]> {
  const errors: FlowError[] = [];

  for (const o of orders) {
    const sapArea = o.sap_area ?? deriveArea(o.System_Status, mappings);

    // E1: Manual vs SAP discrepancy
    if (o.source === 'manual' && sapArea !== o.current_area) {
      errors.push({
        order_id: o.Order,
        Order: o.Order,
        Material: o.Material,
        Plant: o.Plant,
        category: 'E1_DISCREPANCY',
        description: `Manually placed in ${o.current_area}, but SAP mapping says ${sapArea}`,
        current_area: o.current_area,
        sap_area: sapArea,
        system_status: o.System_Status,
      });
    }

    // E4: Invalid dates or quantities
    const start = o.Start_date_sched;
    const finish = o.Scheduled_finish_date;
    if (start && finish && start > finish) {
      errors.push({
        order_id: o.Order,
        Order: o.Order,
        Material: o.Material,
        Plant: o.Plant,
        category: 'E4_INVALID',
        description: `Finish date (${finish}) is before start date (${start})`,
        system_status: o.System_Status,
      });
    }
    if (o.Order_quantity <= 0) {
      errors.push({
        order_id: o.Order,
        Order: o.Order,
        Material: o.Material,
        Plant: o.Plant,
        category: 'E4_INVALID',
        description: `Order quantity is ${o.Order_quantity} (must be > 0)`,
        system_status: o.System_Status,
      });
    }
    if (o.Delivered_quantity > o.Order_quantity) {
      errors.push({
        order_id: o.Order,
        Order: o.Order,
        Material: o.Material,
        Plant: o.Plant,
        category: 'E4_INVALID',
        description: `Delivered quantity (${o.Delivered_quantity}) exceeds ordered quantity (${o.Order_quantity})`,
        system_status: o.System_Status,
      });
    }
  }

  // E2: Status regression — compare has_changes orders where changed_fields contains System_Status
  // In LIVE mode the backend should provide this; in DEMO we flag orders with changed status
  for (const o of orders) {
    if (o.has_changes && o.changed_fields?.includes('System_Status')) {
      errors.push({
        order_id: o.Order,
        Order: o.Order,
        Material: o.Material,
        Plant: o.Plant,
        category: 'E2_REGRESS',
        description: `System status changed in latest upload — verify progression`,
        system_status: o.System_Status,
      });
    }
  }

  return errors;
}

// ============================================================
// TIMELINE API
// ============================================================
export async function getOrderTimeline(orderId: string): Promise<OrderTimeline | null> {
  if (isDemo()) {
    // Generate a synthetic timeline from mock order data
    const order = _orders.find(o => o.Order === orderId);
    if (!order) return null;
    const entries: OrderTimelineEntry[] = [
      {
        upload_id: 'UPL-20240101-001',
        uploaded_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        version_label: 'Upload 1 — Initial',
        Start_date_sched: shiftDate(order.Start_date_sched, -5),
        Scheduled_finish_date: shiftDate(order.Scheduled_finish_date, -3),
        Order_quantity: Math.round(order.Order_quantity * 0.9),
        System_Status: 'CRTD',
      },
      {
        upload_id: 'UPL-20240108-001',
        uploaded_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        version_label: 'Upload 2 — Revised',
        Start_date_sched: shiftDate(order.Start_date_sched, -2),
        Scheduled_finish_date: order.Scheduled_finish_date,
        Order_quantity: order.Order_quantity,
        System_Status: order.System_Status,
      },
      {
        upload_id: 'UPL-20240115-001',
        uploaded_at: new Date().toISOString(),
        version_label: 'Upload 3 — Latest',
        Start_date_sched: order.Start_date_sched,
        Scheduled_finish_date: order.Scheduled_finish_date,
        Order_quantity: order.Order_quantity,
        System_Status: order.System_Status,
      },
    ];
    return { order_id: orderId, entries };
  }

  try {
    const path = resolvePath(ep().orderTimelinePath, { order_id: orderId });
    return await apiFetch<OrderTimeline>(path);
  } catch {
    return null;
  }
}

function shiftDate(dateStr: string | undefined | null, days: number): string {
  if (!dateStr) {
    // Fallback to today ± days
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().split('T')[0];
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ============================================================
// ISSUES API
// ============================================================
export async function getIssues(orderId: string): Promise<Issue[]> {
  if (isDemo()) return _issues.filter(i => i.order_id === orderId);
  const path = resolvePath(ep().orderIssuesPath, { order_id: orderId });
  return apiFetch<Issue[]>(path);
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
  const path = resolvePath(ep().orderIssuesPath, { order_id: orderId });
  return apiFetch<Issue>(path, {
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
  const path = resolvePath(ep().issuePath, { issue_id: issueId });
  return apiFetch<Issue>(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getIssueHistory(issueId: string): Promise<IssueHistoryEntry[]> {
  if (isDemo()) return _issueHistory.filter(h => h.issue_id === issueId);
  const path = resolvePath(ep().issueHistoryPath, { issue_id: issueId });
  return apiFetch<IssueHistoryEntry[]>(path);
}

// ============================================================
// PRODUCTION API
// ============================================================
export async function getProductionStatus(orderId: string): Promise<ProductionStatus | undefined> {
  if (isDemo()) return _productionStatus[orderId];
  return apiFetch<ProductionStatus>(`${ep().ordersPath}/${orderId}/production-status`);
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
  return apiFetch<ProductionStatus>(`${ep().ordersPath}/${orderId}/production-status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ============================================================
// LOGISTICS API
// ============================================================
export async function getLogisticsStatus(orderId: string): Promise<LogisticsStatus | undefined> {
  if (isDemo()) return _logisticsStatus[orderId];
  return apiFetch<LogisticsStatus>(`${ep().ordersPath}/${orderId}/logistics-status`);
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
  return apiFetch<LogisticsStatus>(`${ep().ordersPath}/${orderId}/logistics-status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================
// DEMO ONLY: Move order between areas (legacy / simple)
// ============================================================
export async function demoMoveOrder(orderId: string, targetArea: Area): Promise<Order> {
  const idx = _orders.findIndex(o => o.Order === orderId);
  if (idx === -1) throw new Error('Order not found');
  const prev = _orders[idx];
  const sapArea = deriveArea(prev.System_Status, _statusMappings);
  const updated = {
    ..._orders[idx],
    current_area: targetArea,
    source: 'manual' as const,
    sap_area: sapArea,
    discrepancy: sapArea !== targetArea,
  };
  _orders = [..._orders.slice(0, idx), updated, ..._orders.slice(idx + 1)];
  return updated;
}

// ============================================================
// Mark Order Ready (Warehouse → Production)
// ============================================================
export async function markOrderReady(orderId: string): Promise<Order> {
  if (isDemo()) {
    return demoMoveOrder(orderId, 'Production');
  }
  return apiFetch<Order>(`${ep().ordersPath}/${orderId}/mark-ready`, { method: 'POST' });
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
    const eff = getEffectiveStatus(o.System_Status, mappings);
    const label = eff ? eff.mapped_label : o.System_Status;
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
  _moveAuditTrail = [];
}
