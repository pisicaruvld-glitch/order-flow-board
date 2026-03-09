// ============================================================
// PALLET / DELIVERY PREPARATION API
// ============================================================

import { loadConfig } from "./appConfig";

function apiBase() {
  return loadConfig().apiBaseUrl;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
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

// Types
export type PalletStatus = "DRAFT" | "READY" | "SHIPPED";

export interface PalletLine {
  id: number;
  pallet_id: number;
  order_id: string;
  qty_on_pallet: number;
  // joined from order
  order_number?: string;
  material?: string;
  material_description?: string;
}

export interface Pallet {
  id: number;
  pallet_no: string;
  pallet_weight_kg: number;
  status: PalletStatus;
  created_by: string;
  created_at: string;
  shipped_at?: string | null;
  shipped_by?: string | null;
  shipped_doc?: string | null;
  lines?: PalletLine[];
}

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

// API functions
export async function getPallets(): Promise<Pallet[]> {
  return apiFetch<Pallet[]>("/logistics/pallets");
}

export async function getPallet(palletId: number): Promise<Pallet> {
  return apiFetch<Pallet>(`/logistics/pallets/${palletId}`);
}

export async function createPallet(payload: CreatePalletPayload): Promise<Pallet> {
  return apiFetch<Pallet>("/logistics/pallets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePallet(palletId: number, payload: UpdatePalletPayload): Promise<Pallet> {
  return apiFetch<Pallet>(`/logistics/pallets/${palletId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
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
