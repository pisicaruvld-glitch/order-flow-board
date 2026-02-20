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
  // New fields
  Priority?: string;         // "/", "o", "x", or empty
  has_changes?: boolean;     // true if any tracked field changed vs previous upload
  changed_fields?: string[]; // e.g. ["Order_quantity", "Start_date_sched"]
}

export interface StatusMapping {
  id: string;
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
};

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'DEMO',
  apiBaseUrl: 'http://localhost:8000/api',
  userRole: 'admin',
  endpoints: { ...DEFAULT_ENDPOINTS },
};

export const AREAS: Area[] = ['Orders', 'Warehouse', 'Production', 'Logistics'];

export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'MISSING_MATERIAL', label: 'Missing Material' },
  { value: 'QUANTITY_MISMATCH', label: 'Quantity Mismatch' },
  { value: 'DAMAGED_GOODS', label: 'Damaged Goods' },
  { value: 'WRONG_ITEM', label: 'Wrong Item' },
  { value: 'DOCUMENTATION_ERROR', label: 'Documentation Error' },
  { value: 'OTHER', label: 'Other' },
];
