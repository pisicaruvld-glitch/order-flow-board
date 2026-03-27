// ============================================================
// PALLET / DELIVERY PREPARATION API
// ============================================================

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
      if (body?.detail) {
        errorMsg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      } else if (body?.message) {
        errorMsg = body.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

// ── Backend raw types ──

interface BackendPalletListItem {
  pallet_id: number;
  pallet_no: string;
  pallet_weight_kg: number;
  status: PalletStatus;
  created_at: string;
  updated_at?: string;
  created_by: string;
  shipped_at?: string | null;
  shipped_by?: string | null;
}

interface BackendPalletLine {
  pallet_line_id: number;
  pallet_id: number;
  order_id: string;
  qty_on_pallet: number;
  created_at?: string;
  updated_at?: string;
  Material?: string;
  Material_description?: string;
  Order_quantity?: number;
  prod_delivered_qty?: number;
  prod_scrap_qty?: number;
  log_received_qty?: number;
  log_shipped_qty?: number;
  available_to_pallet?: number;
}

interface BackendPalletDetailResponse {
  header: BackendPalletListItem;
  lines: BackendPalletLine[];
}

// ── Frontend normalized types ──

export type PalletStatus = "DRAFT" | "READY" | "SHIPPED";

export interface PalletLine {
  id: number;
  pallet_line_id: number;
  pallet_id: number;
  order_id: string;
  order_number: string;
  qty_on_pallet: number;
  created_at?: string;
  updated_at?: string;
  material?: string;
  material_description?: string;
  order_quantity?: number;
  prod_delivered_qty?: number;
  prod_scrap_qty?: number;
  log_received_qty?: number;
  log_shipped_qty?: number;
  available_to_pallet?: number;
}

export interface Pallet {
  id: number;
  pallet_id: number;
  pallet_no: string;
  pallet_weight_kg: number;
  status: PalletStatus;
  created_at: string;
  updated_at?: string;
  created_by: string;
  shipped_at?: string | null;
  shipped_by?: string | null;
  shipped_doc?: string | null;
  lines?: PalletLine[];
}

// ── Normalization helpers ──

function normalizePalletListItem(raw: BackendPalletListItem): Pallet {
  return {
    id: raw.pallet_id,
    pallet_id: raw.pallet_id,
    pallet_no: raw.pallet_no,
    pallet_weight_kg: raw.pallet_weight_kg,
    status: raw.status,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    created_by: raw.created_by ?? "-",
    shipped_at: raw.shipped_at,
    shipped_by: raw.shipped_by,
    shipped_doc: null,
  };
}

function normalizePalletLine(raw: BackendPalletLine): PalletLine {
  return {
    id: raw.pallet_line_id,
    pallet_line_id: raw.pallet_line_id,
    pallet_id: raw.pallet_id,
    order_id: raw.order_id,
    order_number: raw.order_id,
    qty_on_pallet: raw.qty_on_pallet,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    material: raw.Material,
    material_description: raw.Material_description,
    order_quantity: raw.Order_quantity,
    prod_delivered_qty: raw.prod_delivered_qty,
    prod_scrap_qty: raw.prod_scrap_qty,
    log_received_qty: raw.log_received_qty,
    log_shipped_qty: raw.log_shipped_qty,
    available_to_pallet: raw.available_to_pallet,
  };
}

function normalizePalletDetail(raw: BackendPalletDetailResponse): Pallet {
  const p = normalizePalletListItem(raw.header);
  p.lines = (raw.lines ?? []).map(normalizePalletLine);
  return p;
}

// ── Payload types ──

export interface CreatePalletPayload {
  pallet_no: string;
  pallet_weight_kg: number;
  created_by: string;
  lines: { order_id: string; qty_on_pallet: number }[];
}

export interface AddPalletLinesPayload {
  lines: { order_id: string; qty_on_pallet: number }[];
}

export interface UpdatePalletPayload {
  pallet_no?: string;
  pallet_weight_kg?: number;
  status?: PalletStatus;
}

export interface UpdatePalletLinePayload {
  qty_on_pallet: number;
}

export interface ShipPalletPayload {
  shipped_by: string;
  shipped_doc?: string;
}

// ── API functions ──

export async function getPallets(): Promise<Pallet[]> {
  const raw = await apiFetch<BackendPalletListItem[]>("/logistics/pallets");
  return raw.map(normalizePalletListItem);
}

export async function getPallet(palletId: number): Promise<Pallet> {
  const raw = await apiFetch<BackendPalletDetailResponse>(`/logistics/pallets/${palletId}`);
  return normalizePalletDetail(raw);
}

export async function createPallet(payload: CreatePalletPayload): Promise<Pallet> {
  const raw = await apiFetch<BackendPalletListItem>("/logistics/pallets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizePalletListItem(raw);
}

export async function updatePallet(palletId: number, payload: UpdatePalletPayload): Promise<Pallet> {
  const raw = await apiFetch<BackendPalletListItem>(`/logistics/pallets/${palletId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizePalletListItem(raw);
}

export async function addPalletLines(palletId: number, payload: AddPalletLinesPayload): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/pallets/${palletId}/lines`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePalletLine(palletLineId: number, payload: UpdatePalletLinePayload): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/pallet-lines/${palletLineId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePalletLine(palletLineId: number): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/pallet-lines/${palletLineId}`, {
    method: "DELETE",
  });
}

export async function shipPallet(palletId: number, payload: ShipPalletPayload): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/pallets/${palletId}/ship`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
