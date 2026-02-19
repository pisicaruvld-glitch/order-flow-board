import {
  Order,
  StatusMapping,
  Issue,
  IssueHistoryEntry,
  ProductionStatus,
  LogisticsStatus,
} from './types';

// ============================================================
// MOCK STATUS MAPPINGS
// ============================================================
export const MOCK_STATUS_MAPPINGS: StatusMapping[] = [
  { id: '1', system_status_value: 'CRTD', mapped_area: 'Orders',     mapped_label: 'Created',              sort_order: 1, is_active: true },
  { id: '2', system_status_value: 'REL',  mapped_area: 'Orders',     mapped_label: 'Released',             sort_order: 2, is_active: true },
  { id: '3', system_status_value: 'PREL', mapped_area: 'Orders',     mapped_label: 'Pre-Released',         sort_order: 3, is_active: true },
  { id: '4', system_status_value: 'GMPS', mapped_area: 'Warehouse',  mapped_label: 'Goods Movement Start', sort_order: 1, is_active: true },
  { id: '5', system_status_value: 'MSTC', mapped_area: 'Warehouse',  mapped_label: 'Material Staged',      sort_order: 2, is_active: true },
  { id: '6', system_status_value: 'MSPT', mapped_area: 'Warehouse',  mapped_label: 'Material Split',       sort_order: 3, is_active: true },
  { id: '7', system_status_value: 'PRC',  mapped_area: 'Production', mapped_label: 'In Production',        sort_order: 1, is_active: true },
  { id: '8', system_status_value: 'PCNF', mapped_area: 'Production', mapped_label: 'Partially Confirmed',  sort_order: 2, is_active: true },
  { id: '9', system_status_value: 'CNF',  mapped_area: 'Production', mapped_label: 'Confirmed',            sort_order: 3, is_active: true },
  { id: '10', system_status_value: 'DLV', mapped_area: 'Logistics',  mapped_label: 'Delivered',            sort_order: 1, is_active: true },
  { id: '11', system_status_value: 'TECO',mapped_area: 'Logistics',  mapped_label: 'Technically Complete', sort_order: 2, is_active: true },
  { id: '12', system_status_value: 'CLSD',mapped_area: 'Logistics',  mapped_label: 'Closed',               sort_order: 3, is_active: false },
];

// ============================================================
// MOCK ORDERS (50 orders)
// ============================================================
const plants = ['PLANT-A', 'PLANT-B', 'PLANT-C', 'PLANT-D'];

const materials: Array<[string, string]> = [
  ['MAT-001', 'Steel Frame Assembly 500x300'],
  ['MAT-002', 'Hydraulic Pump Module HX-200'],
  ['MAT-003', 'Electronic Control Unit ECU-7'],
  ['MAT-004', 'Bearing Set SKF 6205-2RS'],
  ['MAT-005', 'Gear Housing Cast Iron GH-44'],
  ['MAT-006', 'Conveyor Belt Rubber 800mm'],
  ['MAT-007', 'Motor Drive VFD-22kW'],
  ['MAT-008', 'Pressure Sensor PS-300 Bar'],
  ['MAT-009', 'Wiring Harness Automotive WH-12V'],
  ['MAT-010', 'Aluminum Extrusion Profile 6061'],
  ['MAT-011', 'Pneumatic Cylinder PC-80-200'],
  ['MAT-012', 'Filter Element HF3850'],
  ['MAT-013', 'Coupling Flange DN50 PN16'],
  ['MAT-014', 'PLC Module Siemens S7-300'],
  ['MAT-015', 'O-Ring Kit NBR 70 Shore'],
];

function makeDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function mapArea(status: string): Order['current_area'] {
  const m = MOCK_STATUS_MAPPINGS.find(s => s.system_status_value === status);
  return m ? m.mapped_area : 'Orders';
}

const statusPool: string[] = [
  'CRTD','CRTD','CRTD',
  'REL','REL','REL','REL',
  'PREL',
  'GMPS','GMPS','GMPS',
  'MSTC','MSTC','MSTC',
  'MSPT',
  'PRC','PRC','PRC',
  'PCNF','PCNF',
  'CNF','CNF',
  'DLV','DLV','DLV',
  'TECO','TECO',
];

const userStatuses = ['', 'PRIORITY', 'ON-HOLD', 'RUSH', 'NORMAL', 'REVIEW'];

const rawOrders: Omit<Order, 'current_area'>[] = Array.from({ length: 50 }, (_, i) => {
  const idx = i % statusPool.length;
  const systemStatus = statusPool[idx];
  const matIdx = i % materials.length;
  const [mat, matDesc] = materials[matIdx];
  const qty = Math.round((Math.random() * 500 + 50) / 5) * 5;
  const delivered = systemStatus === 'DLV' || systemStatus === 'TECO'
    ? qty
    : systemStatus === 'PRC' || systemStatus === 'PCNF' || systemStatus === 'CNF'
    ? Math.round(qty * Math.random() * 0.6)
    : 0;

  return {
    Order: `ORD-${String(100100 + i).padStart(6, '0')}`,
    Plant: plants[i % plants.length],
    Material: mat,
    Material_description: matDesc,
    Start_date_sched: makeDate(-30 + (i % 60) - 20),
    Scheduled_finish_date: makeDate(10 + (i % 40)),
    Order_quantity: qty,
    Delivered_quantity: delivered,
    System_Status: systemStatus,
    User_Status: userStatuses[i % userStatuses.length],
  };
});

export const MOCK_ORDERS: Order[] = rawOrders.map(o => ({
  ...o,
  current_area: mapArea(o.System_Status),
}));

// ============================================================
// MOCK ISSUES
// ============================================================
const warehouseOrders = MOCK_ORDERS.filter(o => o.current_area === 'Warehouse');

export const MOCK_ISSUES: Issue[] = [
  {
    id: 'ISS-001', order_id: warehouseOrders[0]?.Order ?? 'ORD-100103',
    pn: 'PN-44521', issue_type: 'MISSING_MATERIAL',
    comment: 'Part number PN-44521 not found in picking location B-23.',
    status: 'OPEN', created_at: makeDate(-3) + 'T09:15:00Z',
    updated_at: makeDate(-3) + 'T09:15:00Z', created_by: 'jsmith',
  },
  {
    id: 'ISS-002', order_id: warehouseOrders[0]?.Order ?? 'ORD-100103',
    pn: 'PN-78900', issue_type: 'QUANTITY_MISMATCH',
    comment: 'Ordered 20 units but only 15 in stock. Need replenishment.',
    status: 'CLOSED', created_at: makeDate(-5) + 'T11:30:00Z',
    updated_at: makeDate(-2) + 'T14:00:00Z', created_by: 'mdavis',
  },
  {
    id: 'ISS-003', order_id: warehouseOrders[1]?.Order ?? 'ORD-100106',
    pn: 'PN-22310', issue_type: 'DAMAGED_GOODS',
    comment: 'Bearing set received with visible damage on outer race.',
    status: 'OPEN', created_at: makeDate(-1) + 'T08:00:00Z',
    updated_at: makeDate(-1) + 'T08:00:00Z', created_by: 'alee',
  },
  {
    id: 'ISS-004', order_id: warehouseOrders[2]?.Order ?? 'ORD-100109',
    pn: 'PN-55001', issue_type: 'DOCUMENTATION_ERROR',
    comment: 'Picking slip shows incorrect material number. SAP and physical label mismatch.',
    status: 'OPEN', created_at: makeDate(-2) + 'T13:45:00Z',
    updated_at: makeDate(-2) + 'T13:45:00Z', created_by: 'jsmith',
  },
  {
    id: 'ISS-005', order_id: warehouseOrders[3]?.Order ?? 'ORD-100112',
    pn: 'PN-11002', issue_type: 'WRONG_ITEM',
    comment: 'Received M8 bolts instead of M10 as specified.',
    status: 'CLOSED', created_at: makeDate(-7) + 'T10:00:00Z',
    updated_at: makeDate(-4) + 'T16:30:00Z', created_by: 'rgarcia',
  },
];

export const MOCK_ISSUE_HISTORY: IssueHistoryEntry[] = [
  {
    id: 'H-001', issue_id: 'ISS-001', action: 'CREATED',
    changed_by: 'jsmith', changed_at: makeDate(-3) + 'T09:15:00Z',
    details: 'Issue created.',
  },
  {
    id: 'H-002', issue_id: 'ISS-002', action: 'CREATED',
    changed_by: 'mdavis', changed_at: makeDate(-5) + 'T11:30:00Z',
    details: 'Issue created.',
  },
  {
    id: 'H-003', issue_id: 'ISS-002', action: 'STATUS_CHANGE',
    changed_by: 'supervisor1', changed_at: makeDate(-2) + 'T14:00:00Z',
    details: 'Status changed from OPEN to CLOSED. Replenishment confirmed.',
  },
  {
    id: 'H-004', issue_id: 'ISS-005', action: 'CREATED',
    changed_by: 'rgarcia', changed_at: makeDate(-7) + 'T10:00:00Z',
    details: 'Issue created.',
  },
  {
    id: 'H-005', issue_id: 'ISS-005', action: 'STATUS_CHANGE',
    changed_by: 'jsmith', changed_at: makeDate(-4) + 'T16:30:00Z',
    details: 'Replacement items received and verified. Closed.',
  },
];

// ============================================================
// MOCK PRODUCTION STATUS
// ============================================================
const productionOrders = MOCK_ORDERS.filter(o => o.current_area === 'Production');

export const MOCK_PRODUCTION_STATUS: Record<string, ProductionStatus> = Object.fromEntries(
  productionOrders.map((o, i) => [
    o.Order,
    {
      order_id: o.Order,
      status: i % 3 === 0 ? 'IN_PROGRESS' : i % 3 === 1 ? 'COMPLETED' : 'PENDING',
      updated_at: makeDate(-i) + 'T10:00:00Z',
      updated_by: ['operator1', 'operator2', 'operator3'][i % 3],
    } as ProductionStatus,
  ])
);

// ============================================================
// MOCK LOGISTICS STATUS
// ============================================================
const logisticsOrders = MOCK_ORDERS.filter(o => o.current_area === 'Logistics');

export const MOCK_LOGISTICS_STATUS: Record<string, LogisticsStatus> = Object.fromEntries(
  logisticsOrders.map((o, i) => [
    o.Order,
    {
      order_id: o.Order,
      received_from_production: i % 2 === 0,
      received_at: i % 2 === 0 ? makeDate(-i - 2) + 'T08:00:00Z' : undefined,
      received_by: i % 2 === 0 ? 'logistics1' : undefined,
      delivered: i % 3 === 0,
      delivered_at: i % 3 === 0 ? makeDate(-i) + 'T15:00:00Z' : undefined,
      delivered_by: i % 3 === 0 ? 'logistics2' : undefined,
    } as LogisticsStatus,
  ])
);

// ============================================================
// MOCK CHANGE REPORT (simulated upload diff)
// ============================================================
export const MOCK_CHANGE_REPORT = [
  { order_id: 'ORD-100101', Order: 'ORD-100101', Material: 'MAT-001', field: 'Order_quantity', before: 200, after: 250 },
  { order_id: 'ORD-100104', Order: 'ORD-100104', Material: 'MAT-004', field: 'System_Status', before: 'CRTD', after: 'REL' },
  { order_id: 'ORD-100107', Order: 'ORD-100107', Material: 'MAT-007', field: 'Start_date_sched', before: makeDate(-10), after: makeDate(-5) },
  { order_id: 'ORD-100110', Order: 'ORD-100110', Material: 'MAT-010', field: 'Order_quantity', before: 100, after: 80 },
  { order_id: 'ORD-100113', Order: 'ORD-100113', Material: 'MAT-013', field: 'Scheduled_finish_date', before: makeDate(5), after: makeDate(15) },
];

export const MOCK_UPLOAD_RESULT = {
  upload_id: 'UPL-20240219-001',
  rows_loaded: 50,
  rows_failed: 2,
  validation_errors: [
    'Row 12: Missing required field "Plant"',
    'Row 37: Invalid date format in Start_date_sched',
  ],
};
