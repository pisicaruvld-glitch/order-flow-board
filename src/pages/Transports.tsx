import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from "@/components/Layout";
import {
  TransportHeader, TransportDetail, TransportPallet, UnassignedPallet,
  TransportStatus, CreateTransportPayload, UpdateTransportPayload,
  getTransports, getTransport, createTransport, updateTransport,
  assignPalletsToTransport, unassignPalletFromTransport, shipTransport,
  getUnassignedPallets,
} from "@/lib/transportApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Truck, Plus, RefreshCw, Package, Send, Trash2, Edit2,
  ChevronDown, ChevronRight, ArrowLeft, CheckSquare, Search, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// ── Status helpers ──
function statusColor(s: TransportStatus | string) {
  if (s === "SHIPPED") return "bg-success/10 text-success border-success/30";
  if (s === "READY") return "bg-primary/10 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function TransportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Queries ──
  const transportsQ = useQuery({ queryKey: ["transports"], queryFn: getTransports });
  const unassignedQ = useQuery({ queryKey: ["unassignedPallets"], queryFn: getUnassignedPallets });

  const transports = transportsQ.data ?? [];
  const unassigned = unassignedQ.data ?? [];

  // ── State ──
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create / Edit
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateTransportPayload>({ transport_no: "" });
  const [saving, setSaving] = useState(false);

  // Detail
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailQ = useQuery({
    queryKey: ["transport", selectedId],
    queryFn: () => getTransport(selectedId!),
    enabled: selectedId != null,
  });
  const detail: TransportDetail | undefined = detailQ.data;

  // Assign pallets
  const [selectedPalletIds, setSelectedPalletIds] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Ship dialog
  const [showShipDialog, setShowShipDialog] = useState(false);
  const [shipBy, setShipBy] = useState("");
  const [shipDoc, setShipDoc] = useState("");
  const [shipping, setShipping] = useState(false);

  const refreshAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["transports"] });
    qc.invalidateQueries({ queryKey: ["unassignedPallets"] });
    if (selectedId) qc.invalidateQueries({ queryKey: ["transport", selectedId] });
    qc.invalidateQueries({ queryKey: ["logisticsOrdersWorklist"] });
  }, [qc, selectedId]);

  // ── Filtered list ──
  const filtered = transports.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const fields = [t.transport_no, t.carrier, t.truck_no, t.destination].filter(Boolean).map(s => s!.toLowerCase());
      if (!fields.some(f => f.includes(q))) return false;
    }
    return true;
  });

  // ── Handlers ──
  const openCreate = () => {
    setEditingId(null);
    setFormData({ transport_no: "" });
    setShowForm(true);
  };

  const openEdit = (t: TransportHeader) => {
    setEditingId(t.transport_id);
    setFormData({
      transport_no: t.transport_no,
      carrier: t.carrier ?? "",
      truck_no: t.truck_no ?? "",
      destination: t.destination ?? "",
      planned_ship_at: t.planned_ship_at ?? "",
      shipping_doc: t.shipping_doc ?? "",
      status: t.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.transport_no.trim()) { toast.error("Transport number is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { transport_no, carrier, truck_no, destination, planned_ship_at, shipping_doc, status } = formData;
        await updateTransport(editingId, { transport_no, carrier, truck_no, destination, planned_ship_at, shipping_doc, status } as UpdateTransportPayload);
        toast.success("Transport updated");
      } else {
        await createTransport(formData);
        toast.success("Transport created");
      }
      setShowForm(false);
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (t: TransportHeader) => {
    setSelectedId(t.transport_id);
    setTab("detail");
  };

  const handleAssign = async () => {
    if (!selectedId || selectedPalletIds.size === 0) return;
    setAssigning(true);
    try {
      await assignPalletsToTransport(selectedId, Array.from(selectedPalletIds));
      toast.success(`${selectedPalletIds.size} pallet(s) assigned`);
      setSelectedPalletIds(new Set());
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (palletId: number) => {
    if (!selectedId) return;
    try {
      await unassignPalletFromTransport(selectedId, palletId);
      toast.success("Pallet removed from transport");
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const handleShip = async () => {
    if (!selectedId) return;
    setShipping(true);
    try {
      await shipTransport(selectedId, {
        shipping_doc: shipDoc.trim() || undefined,
      });
      toast.success("Transport shipped");
      setShowShipDialog(false);
      setShipBy("");
      setShipDoc("");
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to ship");
    } finally {
      setShipping(false);
    }
  };

  const togglePalletSelection = (id: number) => {
    setSelectedPalletIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isShipped = detail?.header.status === "SHIPPED";
  const canShip = detail && !isShipped && (detail.pallets?.length ?? 0) > 0;

  // ── KPIs for detail ──
  const totalPallets = detail?.pallets?.length ?? 0;
  const totalQty = detail?.pallets?.reduce((s, p) => s + (p.total_qty ?? 0), 0) ?? 0;
  const draftPallets = detail?.pallets?.filter(p => p.status === "DRAFT").length ?? 0;
  const shippedPallets = detail?.pallets?.filter(p => p.status === "SHIPPED").length ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Transports"
        subtitle="Manage transport shipments"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/logistics")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} />Back
            </button>
            <button onClick={openCreate} className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors">
              <Plus size={14} />New Transport
            </button>
            <button onClick={refreshAll} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Transport List</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedId}>Transport Detail</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned Pallets ({unassigned.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB: Transport List ── */}
        <TabsContent value="list">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 mt-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search transport no, carrier, truck, destination…"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
              <option value="SHIPPED">SHIPPED</option>
            </select>
          </div>

          {transportsQ.isLoading && <LoadingSpinner label="Loading transports…" />}
          {transportsQ.isError && <ErrorMessage message="Failed to load transports" onRetry={() => transportsQ.refetch()} />}

          {!transportsQ.isLoading && !transportsQ.isError && (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No transports found.</p>
              ) : (
                filtered.map(t => (
                  <div key={t.transport_id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
                    <Truck size={16} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openDetail(t)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold">{t.transport_no}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(t.status))}>
                          {t.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{t.pallet_count ?? 0} pallets</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        {t.carrier && <span>Carrier: {t.carrier}</span>}
                        {t.truck_no && <span>Truck: {t.truck_no}</span>}
                        {t.destination && <span>Dest: {t.destination}</span>}
                        {t.planned_ship_at && <span>Planned: {new Date(t.planned_ship_at).toLocaleDateString()}</span>}
                        {t.shipped_at && <span>Shipped: {new Date(t.shipped_at).toLocaleDateString()}</span>}
                        <span>By: {t.created_by ?? "-"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.status !== "SHIPPED" && (
                        <button onClick={() => openEdit(t)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Edit2 size={12} />
                        </button>
                      )}
                      <button onClick={() => openDetail(t)} className="px-2 py-1 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Transport Detail ── */}
        <TabsContent value="detail">
          {!selectedId ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Select a transport from the list.</p>
          ) : detailQ.isLoading ? (
            <LoadingSpinner label="Loading transport…" />
          ) : detailQ.isError ? (
            <ErrorMessage message="Failed to load transport details" onRetry={() => detailQ.refetch()} />
          ) : detail ? (
            <div className="space-y-4 mt-2">
              {/* Header card */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Truck size={16} className="text-primary" />
                      <span className="font-mono text-sm font-bold">{detail.header.transport_no}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(detail.header.status))}>
                        {detail.header.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-[11px]">
                      <div><span className="text-muted-foreground">Carrier:</span> {detail.header.carrier ?? "-"}</div>
                      <div><span className="text-muted-foreground">Truck:</span> {detail.header.truck_no ?? "-"}</div>
                      <div><span className="text-muted-foreground">Destination:</span> {detail.header.destination ?? "-"}</div>
                      <div><span className="text-muted-foreground">Planned Ship:</span> {detail.header.planned_ship_at ? new Date(detail.header.planned_ship_at).toLocaleDateString() : "-"}</div>
                      <div><span className="text-muted-foreground">Shipping Doc:</span> {detail.header.shipping_doc ?? "-"}</div>
                      <div><span className="text-muted-foreground">Created by:</span> {detail.header.created_by ?? "-"}</div>
                      <div><span className="text-muted-foreground">Shipped at:</span> {detail.header.shipped_at ? new Date(detail.header.shipped_at).toLocaleString() : "-"}</div>
                      <div><span className="text-muted-foreground">Shipped by:</span> {detail.header.shipped_by ?? "-"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isShipped && (
                      <button onClick={() => openEdit(detail.header)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Edit2 size={10} />Edit
                      </button>
                    )}
                    {canShip && (
                      <button onClick={() => setShowShipDialog(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Send size={12} />Ship Transport
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Pallets", value: totalPallets },
                  { label: "Total Qty", value: totalQty },
                  { label: "Draft Pallets", value: draftPallets },
                  { label: "Shipped Pallets", value: shippedPallets },
                ].map(k => (
                  <div key={k.label} className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-foreground">{k.value}</div>
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Assigned pallets */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Assigned Pallets</p>
                {(detail.pallets ?? []).length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-2">No pallets assigned to this transport.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.pallets.map(p => (
                      <div key={p.transport_pallet_id} className="bg-background border border-border rounded p-2 flex items-center gap-3 text-xs">
                        <Package size={12} className="text-muted-foreground shrink-0" />
                        <span className="font-mono font-medium">{p.pallet_no}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(p.status))}>{p.status}</span>
                        <span className="text-muted-foreground">{p.pallet_weight_kg} kg</span>
                        <span className="text-muted-foreground">{p.line_count} lines</span>
                        <span className="text-muted-foreground">{p.total_qty} pcs</span>
                        <span className="text-muted-foreground ml-auto">{p.created_by ?? "-"}</span>
                        {!isShipped && (
                          <button
                            onClick={() => handleUnassign(p.pallet_id)}
                            className="p-1 text-destructive/70 hover:text-destructive transition-colors"
                            title="Remove from transport"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick assign from unassigned */}
              {!isShipped && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-foreground mb-2">
                    Assign Pallets ({unassigned.length} available)
                  </p>
                  {unassigned.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No unassigned pallets available.</p>
                  ) : (
                    <>
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded p-2">
                        {unassigned.map(p => (
                          <label key={p.pallet_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded p-1 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedPalletIds.has(p.pallet_id)}
                              onChange={() => togglePalletSelection(p.pallet_id)}
                              className="rounded"
                            />
                            <span className="font-mono text-[10px] font-medium">{p.pallet_no}</span>
                            <span className="text-[10px] text-muted-foreground">{p.pallet_weight_kg} kg</span>
                            <span className="text-[10px] text-muted-foreground">{p.line_count ?? 0} lines</span>
                            <span className="text-[10px] text-muted-foreground">{p.total_qty ?? 0} pcs</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{p.created_by ?? "-"}</span>
                          </label>
                        ))}
                      </div>
                      {selectedPalletIds.size > 0 && (
                        <button
                          onClick={handleAssign}
                          disabled={assigning}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          <CheckSquare size={12} />
                          {assigning ? "Assigning…" : `Assign ${selectedPalletIds.size} pallet(s)`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* ── TAB: Unassigned Pallets ── */}
        <TabsContent value="unassigned">
          {unassignedQ.isLoading && <LoadingSpinner label="Loading unassigned pallets…" />}
          {unassignedQ.isError && <ErrorMessage message="Failed to load unassigned pallets" onRetry={() => unassignedQ.refetch()} />}

          {!unassignedQ.isLoading && !unassignedQ.isError && (
            <div className="space-y-2 mt-2">
              {unassigned.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">All pallets are assigned to transports or shipped.</p>
              ) : (
                unassigned.map(p => (
                  <div key={p.pallet_id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs">
                    <Package size={14} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{p.pallet_no}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(p.status))}>{p.status}</span>
                        <span className="text-muted-foreground">{p.pallet_weight_kg} kg</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {p.line_count ?? 0} lines · {p.total_qty ?? 0} pcs · By: {p.created_by ?? "-"} · {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Transport" : "Create Transport"}</h3>
            <div className="space-y-2">
              <Field label="Transport No *" value={formData.transport_no} onChange={v => setFormData(p => ({ ...p, transport_no: v }))} placeholder="e.g. TR-001" />
              <Field label="Carrier" value={formData.carrier ?? ""} onChange={v => setFormData(p => ({ ...p, carrier: v }))} placeholder="Carrier name" />
              <Field label="Truck No" value={formData.truck_no ?? ""} onChange={v => setFormData(p => ({ ...p, truck_no: v }))} placeholder="Truck plate" />
              <Field label="Destination" value={formData.destination ?? ""} onChange={v => setFormData(p => ({ ...p, destination: v }))} placeholder="Delivery address" />
              <Field label="Planned Ship Date" value={formData.planned_ship_at ?? ""} onChange={v => setFormData(p => ({ ...p, planned_ship_at: v }))} placeholder="YYYY-MM-DD" type="date" />
              <Field label="Shipping Doc" value={formData.shipping_doc ?? ""} onChange={v => setFormData(p => ({ ...p, shipping_doc: v }))} placeholder="e.g. CMR-123" />
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Status</label>
                <select
                  value={formData.status ?? "DRAFT"}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value as TransportStatus }))}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="READY">READY</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ship Confirm Dialog ── */}
      {showShipDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShipDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Ship Transport</h3>
            <p className="text-[11px] text-muted-foreground">
              This will ship <strong>{totalPallets}</strong> pallets with <strong>{totalQty}</strong> total qty. All pallets will be marked as SHIPPED.
            </p>
            <Field label="Shipped by" value={shipBy} onChange={setShipBy} placeholder="Name" />
            <Field label="Shipping Doc (optional)" value={shipDoc} onChange={setShipDoc} placeholder="e.g. AWB-12345" />
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleShip} disabled={shipping} className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Send size={11} className="inline mr-1" />{shipping ? "Shipping…" : "Confirm Ship"}
              </button>
              <button onClick={() => setShowShipDialog(false)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// ── Tiny reusable form field ──
function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={placeholder}
      />
    </div>
  );
}
