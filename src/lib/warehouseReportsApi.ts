import { fetchApi, fetchApiJson } from './http';

// ============================================================
// Warehouse Reports API – KPI-scoped, scalable for additional KPIs
// ============================================================

export type GroupBy = 'day' | 'week' | 'month' | 'year';
export type TargetDirection = 'MAX' | 'MIN';

export interface KpiDefinition {
  code: string;
  label: string;
  unit?: string | null;
  target_value?: number | null;
  target_direction?: TargetDirection | null;
  current_value?: number | null;
  last_entry_date?: string | null;
}

export interface KpiListResponse {
  kpis: KpiDefinition[];
}

export interface KpiEntry {
  id?: number | string;
  entry_date: string;
  value: number;
  comment?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface KpiEntriesResponse {
  entries: KpiEntry[];
}

export interface KpiTimelinePoint {
  bucket: string;
  value: number;
}

export interface KpiPieSlice {
  label?: string;
  category_label?: string;
  category_code?: string;
  code?: string;
  value: number;
}

export interface KpiSeriesPoint {
  bucket: string;
  // Either { value } for single-series, or category-keyed values for multi-series
  value?: number;
  total?: number;
  [categoryCode: string]: string | number | undefined;
}

export interface KpiCategorySeries {
  category_code: string;
  category_label?: string;
  points: KpiTimelinePoint[];
}

export interface KpiSummary {
  kpi_code: string;
  kpi_label?: string;
  target_value?: number | null;
  target_direction?: TargetDirection | null;
  total?: number;
  total_value?: number;
  average?: number;
  timeline?: KpiTimelinePoint[];
  series?: KpiSeriesPoint[] | KpiCategorySeries[];
  line_series?: KpiCategorySeries[];
  pie?: KpiPieSlice[];
  distribution?: KpiPieSlice[];
}

export interface KpiCategory {
  category_code: string;
  category_label: string;
  sort_order?: number;
}

export interface KpiCategoriesResponse {
  categories: KpiCategory[];
}

export interface KpiCategoryEntry {
  category_code: string;
  value: number;
  comment?: string;
}

// ────────────────────────────────────────────────────────────
// Endpoints
// ────────────────────────────────────────────────────────────
export async function getWarehouseKpis(): Promise<KpiListResponse> {
  return fetchApiJson<KpiListResponse>('/api/reports/warehouse/kpis');
}

export async function setKpiTarget(
  kpiCode: string,
  payload: { target_value: number; target_direction: TargetDirection },
): Promise<unknown> {
  return fetchApiJson(`/api/reports/warehouse/kpis/${kpiCode}/target`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getKpiEntries(
  kpiCode: string,
  params?: { date_from?: string; date_to?: string },
): Promise<KpiEntriesResponse> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set('date_from', params.date_from);
  if (params?.date_to) qs.set('date_to', params.date_to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return fetchApiJson<KpiEntriesResponse>(
    `/api/reports/warehouse/kpis/${kpiCode}/entries${suffix}`,
  );
}

export async function saveKpiEntry(
  kpiCode: string,
  payload:
    | { entry_date: string; value: number; comment?: string }
    | { entry_date: string; entries: KpiCategoryEntry[] },
): Promise<unknown> {
  return fetchApiJson(`/api/reports/warehouse/kpis/${kpiCode}/entries`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getKpiCategories(kpiCode: string): Promise<KpiCategoriesResponse> {
  return fetchApiJson<KpiCategoriesResponse>(
    `/api/reports/warehouse/kpis/${kpiCode}/categories`,
  );
}

export async function getKpiSummary(
  kpiCode: string,
  params: { date_from: string; date_to: string; group_by: GroupBy },
): Promise<KpiSummary> {
  const qs = new URLSearchParams({
    date_from: params.date_from,
    date_to: params.date_to,
    group_by: params.group_by,
  });
  return fetchApiJson<KpiSummary>(
    `/api/reports/warehouse/kpis/${kpiCode}/summary?${qs.toString()}`,
  );
}

async function downloadXlsx(path: string, filename: string): Promise<void> {
  const res = await fetchApi(path);
  if (res.status === 401) {
    try { localStorage.removeItem('vsro_auth_token'); } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.location.replace('/login?session=expired');
    throw new Error('Session expired');
  }
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function exportKpiXlsx(
  kpiCode: string,
  params: { date_from: string; date_to: string },
): Promise<void> {
  const qs = new URLSearchParams(params);
  await downloadXlsx(
    `/api/reports/warehouse/kpis/${kpiCode}/export?${qs.toString()}`,
    `${kpiCode}_${params.date_from}_${params.date_to}.xlsx`,
  );
}

// ────────────────────────────────────────────────────────────
// LL01 Errors – dedicated endpoints
// ────────────────────────────────────────────────────────────
export interface Ll01CategoryEntry {
  category_code: string;
  value: number;
  comment?: string;
}

export interface Ll01EntryRow {
  entry_date: string;
  category_code: string;
  value: number;
  comment?: string | null;
}

export async function getLl01Categories(): Promise<KpiCategoriesResponse> {
  return fetchApiJson<KpiCategoriesResponse>(
    '/api/reports/warehouse/ll01-errors/categories',
  );
}

export async function getLl01Entries(params: {
  date_from: string;
  date_to: string;
}): Promise<{ entries: Ll01EntryRow[] }> {
  const qs = new URLSearchParams(params);
  return fetchApiJson(`/api/reports/warehouse/ll01-errors/entries?${qs.toString()}`);
}

export async function saveLl01Entries(payload: {
  entry_date: string;
  entries: Ll01CategoryEntry[];
}): Promise<unknown> {
  return fetchApiJson('/api/reports/warehouse/ll01-errors/entries', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getLl01Summary(params: {
  date_from: string;
  date_to: string;
  group_by: GroupBy;
}): Promise<KpiSummary> {
  const qs = new URLSearchParams(params);
  return fetchApiJson<KpiSummary>(
    `/api/reports/warehouse/ll01-errors/summary?${qs.toString()}`,
  );
}

export async function exportLl01Xlsx(params: {
  date_from: string;
  date_to: string;
}): Promise<void> {
  const qs = new URLSearchParams(params);
  await downloadXlsx(
    `/api/reports/warehouse/ll01-errors/export?${qs.toString()}`,
    `LL01_ERRORS_${params.date_from}_${params.date_to}.xlsx`,
  );
}

// ────────────────────────────────────────────────────────────
// Permissions helper
// ────────────────────────────────────────────────────────────
export function canEditWarehouseKpi(user: {
  role?: string;
  areas?: string[] | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const areas = (user.areas || []).map((a) => a.toLowerCase());
  return areas.includes('warehouse');
}
