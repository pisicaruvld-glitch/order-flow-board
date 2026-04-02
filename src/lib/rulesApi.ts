import { loadConfig } from "./appConfig";

function apiBase() {
  return loadConfig().apiBaseUrl;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("auth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {}
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { headers: authHeaders(), ...options });
  if (!res.ok) {
    let msg = `API Error ${res.status}`;
    try { const b = await res.json(); msg = b.detail || b.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// Types
export interface RuleItem {
  id: number;
  category_id: number;
  rule_key: string;
  rule_title: string;
  content: string;
  sort_order: number;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RuleCategory {
  id: number;
  category_key: string;
  category_title: string;
  sort_order: number;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
  rules: RuleItem[];
}

export interface RulesResponse {
  can_edit: boolean;
  editor_username: string;
  categories: RuleCategory[];
}

// GET
export function getRules(): Promise<RulesResponse> {
  return apiFetch("/api/rules");
}

// Category CRUD
export function createCategory(payload: { category_title: string; category_key: string; sort_order: number; is_active: number }): Promise<RuleCategory> {
  return apiFetch("/api/admin/rules/categories", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCategory(id: number, payload: Partial<{ category_title: string; category_key: string; sort_order: number; is_active: number }>): Promise<RuleCategory> {
  return apiFetch(`/api/admin/rules/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteCategory(id: number): Promise<void> {
  return apiFetch(`/api/admin/rules/categories/${id}`, { method: "DELETE" });
}

// Rule item CRUD
export function createRuleItem(payload: { category_id: number; rule_title: string; rule_key: string; rule_content: string; sort_order: number; is_active: number }): Promise<RuleItem> {
  return apiFetch("/api/admin/rules/items", { method: "POST", body: JSON.stringify(payload) });
}

export function updateRuleItem(id: number, payload: Partial<{ category_id: number; rule_title: string; rule_key: string; rule_content: string; sort_order: number; is_active: number }>): Promise<RuleItem> {
  return apiFetch(`/api/admin/rules/items/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteRuleItem(id: number): Promise<void> {
  return apiFetch(`/api/admin/rules/items/${id}`, { method: "DELETE" });
}
