// ============================================================
// VSRO ORDER FLOW DASHBOARD — Core Types
// ============================================================

export type Area = 'Orders' | 'Warehouse' | 'Production' | 'Logistics';

export interface Order {
  Order: string;
  Plant: string;
  Material: string;
  Material_description: string;
  Start_date_sched: string;
  Scheduled_finish_date: string;
  Order_quantity: number;
  Delivered_quantity: number;
  System_Status: string;
  User_Status: string;
  current_area: Area;
  current_label?: string;
  // Priority
  Priority?: string;         // "/", "o", "x", or empty
  // Change tracking
  has_changes?: boolean;
  changed_fields?: string[];
  // Manual flow state
  source?: 'system' | 'manual';  // how current_area was set
  sap_area?: Area;                // area derived from SAP status mapping
  discrepancy?: boolean;          // source=manual AND sap_area != current_area
  product_type?: 'FG' | 'SFG';   // FG = finite, SFG = semifinite
}

export interface StatusMapping {
  id: string;
  row_key?: string;
  system_status_value: string;
  mapped_area: Area;
  mapped_label: string;
  sort_order: number;
  is_active: boolean;
}

export interface Issue {
  id: string;
  order_id: string;
  pn: string;
  issue_type: IssueType;
  comment: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type IssueType =
  | 'MISSING_MATERIAL'
  | 'QUANTITY_MISMATCH'
  | 'DAMAGED_GOODS'
  | 'WRONG_ITEM'
  | 'DOCUMENTATION_ERROR'
  | 'OTHER';

export interface IssueHistoryEntry {
  id: string;
  issue_id: string;
  action: string;
  changed_by: string;
  changed_at: string;
  details: string;
}

export interface UploadResult {
  upload_id: string;
  rows_loaded: number;
  rows_failed: number;
  validation_errors: string[];
}

export interface OrderChange {
  order_id: string;
  Order: string;
  Material: string;
  field: string;
  before: string | number;
  after: string | number;
}

export interface ProductionStatus {
  order_id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  updated_at: string;
  updated_by: string;
}

export interface LogisticsStatus {
  order_id: string;
  received_from_production: boolean;
  received_at?: string;
  received_by?: string;
  delivered: boolean;
  delivered_at?: string;
  delivered_by?: string;
}

// ============================================================
// Timeline / Gantt
// ============================================================
export interface OrderTimelineEntry {
  upload_id?: string;
  uploaded_at?: string;
  version_label?: string;
  Start_date_sched: string;
  Scheduled_finish_date: string;
  Order_quantity: number;
  System_Status: string;
}

export interface OrderTimeline {
  order_id: string;
  entries: OrderTimelineEntry[];
}

// ============================================================
// Manual Override / Flow State
// ============================================================
export interface FlowMoveRequest {
  order_id: string;
  target_area: Area;
  justification?: string;  // required for move-back
  moved_by?: string;
}

export interface FlowMoveResult {
  order_id: string;
  previous_area: Area;
  current_area: Area;
  source: 'manual';
  moved_at: string;
  moved_by: string;
}

// ============================================================
// Area Modes
// ============================================================
export type AreaMode = 'AUTO' | 'MANUAL';

export interface AreaModes {
  Warehouse: AreaMode;
  Production: AreaMode;
  Logistics: AreaMode;
}

export const DEFAULT_AREA_MODES: AreaModes = {
  Warehouse: 'AUTO',
  Production: 'AUTO',
  Logistics: 'AUTO',
};

// ============================================================
// Error / Discrepancy types (Errors page)
// ============================================================
export type ErrorCategory = 'E1_DISCREPANCY' | 'E2_REGRESS' | 'E3_MISSING' | 'E4_INVALID';

export interface FlowError {
  order_id: string;
  Order: string;
  Material: string;
  Plant: string;
  category: ErrorCategory;
  description: string;
  current_area?: Area;
  sap_area?: Area;
  system_status?: string;
  last_upload_at?: string;
}

// ============================================================
// App Config — includes endpoint mapping
// ============================================================
export interface EndpointPaths {
  healthPath: string;
  ordersPath: string;
  uploadOrdersPath: string;
  statusMappingPath: string;
  orderTimelinePath: string;
  orderIssuesPath: string;   // /orders/{order_id}/issues
  issuePath: string;         // /issues/{issue_id}
  issueHistoryPath: string;  // /issues/{issue_id}/history
  moveOrderPath: string;     // /orders/{order_id}/move
  areaModesPath: string;     // /admin/app-settings/area_modes
}

export interface AppConfig {
  mode: 'DEMO' | 'LIVE';
  apiBaseUrl: string;
  userRole: 'admin' | 'user';
  endpoints: EndpointPaths;
}

export const DEFAULT_ENDPOINTS: EndpointPaths = {
  healthPath: '/health',
  ordersPath: '/orders',
  uploadOrdersPath: '/uploads/orders',
  statusMappingPath: '/admin/status-mapping',
  orderTimelinePath: '/orders/{order_id}/timeline',
  orderIssuesPath: '/orders/{order_id}/issues',
  issuePath: '/issues/{issue_id}',
  issueHistoryPath: '/issues/{issue_id}/history',
  moveOrderPath: '/orders/{order_id}/move',
  areaModesPath: '/admin/app-settings/area_modes',
};

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'DEMO',
  apiBaseUrl: 'http://localhost:8000/api',
  userRole: 'admin',
  endpoints: { ...DEFAULT_ENDPOINTS },
};

export const AREAS: Area[] = ['Orders', 'Warehouse', 'Production', 'Logistics'];
export const FLOW_AREAS: Area[] = ['Warehouse', 'Production', 'Logistics'];

export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'MISSING_MATERIAL', label: 'Missing Material' },
  { value: 'QUANTITY_MISMATCH', label: 'Quantity Mismatch' },
  { value: 'DAMAGED_GOODS', label: 'Damaged Goods' },
  { value: 'WRONG_ITEM', label: 'Wrong Item' },
  { value: 'DOCUMENTATION_ERROR', label: 'Documentation Error' },
  { value: 'OTHER', label: 'Other' },
];

export const ERROR_CATEGORY_META: Record<ErrorCategory, { label: string; color: string; description: string }> = {
  E1_DISCREPANCY: {
    label: 'E1 — Manual vs SAP Discrepancy',
    color: 'text-destructive',
    description: 'Order manually placed in a different area than SAP status mapping indicates.',
  },
  E2_REGRESS: {
    label: 'E2 — Status Regression',
    color: 'text-warning',
    description: 'Effective SAP status moved backwards (lower sort_order) compared to previous upload.',
  },
  E3_MISSING: {
    label: 'E3 — Order Missing',
    color: 'text-info',
    description: 'Order was present in the previous upload but absent in the latest upload.',
  },
  E4_INVALID: {
    label: 'E4 — Invalid Data',
    color: 'text-muted-foreground',
    description: 'Invalid dates, zero/negative quantities, or delivered > ordered.',
  },
};
