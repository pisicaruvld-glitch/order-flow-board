import { fetchApi, fetchApiJson, buildApiUrl } from './http';
import { getStoredToken } from './authApi';

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
  label: string;
  code?: string;
  value: number;
}

export interface KpiSummary {
  kpi_code: string;
  kpi_label?: string;
  target_value?: number | null;
  target_direction?: TargetDirection | null;
  total?: number;
  average?: number;
  timeline: KpiTimelinePoint[];
  pie: KpiPieSlice[];
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
  payload: { entry_date: string; value: number; comment?: string },
): Promise<unknown> {
  return fetchApiJson(`/api/reports/warehouse/kpis/${kpiCode}/entries`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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

export async function exportKpiXlsx(
  kpiCode: string,
  params: { date_from: string; date_to: string },
): Promise<void> {
  const qs = new URLSearchParams({
    date_from: params.date_from,
    date_to: params.date_to,
  });
  const url = buildApiUrl(
    `/api/reports/warehouse/kpis/${kpiCode}/export?${qs.toString()}`,
  );
  const token = getStoredToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${kpiCode}_${params.date_from}_${params.date_to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
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
