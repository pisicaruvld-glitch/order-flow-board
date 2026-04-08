// ============================================================
// TRANSPORT MANAGEMENT API
// ============================================================

import { fetchApiJson } from "./http";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApiJson<T>(path, options);
}

// ── Types ──

export type TransportStatus = "DRAFT" | "READY" | "SHIPPED";

export interface TransportHeader {
  transport_id: number;
  transport_no: string;
  carrier?: string | null;
  truck_no?: string | null;
  destination?: string | null;
  status: TransportStatus;
  planned_ship_at?: string | null;
  shipped_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  shipped_by?: string | null;
  shipping_doc?: string | null;
  pallet_count?: number;
}

export interface TransportPallet {
  transport_pallet_id: number;
  pallet_id: number;
  pallet_no: string;
  pallet_weight_kg: number;
  status: string;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  line_count: number;
  total_qty: number;
}

export interface TransportDetail {
  header: TransportHeader;
  pallets: TransportPallet[];
}

export interface UnassignedPallet {
  pallet_id: number;
  pallet_no: string;
  pallet_weight_kg: number;
  status: string;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  line_count?: number;
  total_qty?: number;
}

export interface CreateTransportPayload {
  transport_no: string;
  carrier?: string;
  truck_no?: string;
  destination?: string;
  status?: TransportStatus;
  planned_ship_at?: string;
  shipping_doc?: string;
}

export interface UpdateTransportPayload {
  transport_no?: string;
  carrier?: string;
  truck_no?: string;
  destination?: string;
  status?: TransportStatus;
  planned_ship_at?: string;
  shipping_doc?: string;
}

export interface ShipTransportPayload {
  shipping_doc?: string;
}

// ── API Functions ──

export async function getTransports(): Promise<TransportHeader[]> {
  return apiFetch<TransportHeader[]>("/logistics/transports");
}

export async function getTransport(transportId: number): Promise<TransportDetail> {
  return apiFetch<TransportDetail>(`/logistics/transports/${transportId}`);
}

export async function createTransport(payload: CreateTransportPayload): Promise<TransportHeader> {
  return apiFetch<TransportHeader>("/logistics/transports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTransport(transportId: number, payload: UpdateTransportPayload): Promise<TransportHeader> {
  return apiFetch<TransportHeader>(`/logistics/transports/${transportId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function assignPalletsToTransport(transportId: number, palletIds: number[]): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/transports/${transportId}/pallets`, {
    method: "POST",
    body: JSON.stringify({ pallet_ids: palletIds }),
  });
}

export async function unassignPalletFromTransport(transportId: number, palletId: number): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/transports/${transportId}/pallets/${palletId}`, {
    method: "DELETE",
  });
}

export async function shipTransport(transportId: number, payload: ShipTransportPayload): Promise<unknown> {
  return apiFetch<unknown>(`/logistics/transports/${transportId}/ship`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUnassignedPallets(): Promise<UnassignedPallet[]> {
  return apiFetch<UnassignedPallet[]>("/logistics/unassigned-pallets");
}
