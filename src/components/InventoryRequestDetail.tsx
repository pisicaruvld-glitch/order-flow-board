import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  getInventoryRequest,
  updateInventoryRequest,
  reviewInventoryRequest,
  markSapAdjusted,
  closeInventoryRequest,
  getInventoryRequestHistory,
  submitApprovalDecision,
  type InventoryRequest,
  type InventoryHistoryEntry,
} from "@/lib/inventoryApi";
import { statusColor, diffColor } from "@/pages/StockCheckRequests";
import { RefreshCw, CheckCircle2, ClipboardCheck, FileCheck2, XCircle, ShieldCheck, ShieldX, AlertTriangle } from "lucide-react";

interface Props {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

function approvalStatusColor(status?: string) {
  switch (status) {
    case "APPROVED": return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
    case "REJECTED": return "bg-destructive text-destructive-foreground";
    case "PENDING": return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
    default: return "bg-muted text-muted-foreground";
  }
}

export function InventoryRequestDetail({ requestId, open, onOpenChange, onUpdated }: Props) {
  const [req, setReq] = useState<InventoryRequest | null>(null);
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Editable count fields
  const [sapHbl, setSapHbl] = useState(0);
  const [sapProduction, setSapProduction] = useState(0);
  const [physicalHbl, setPhysicalHbl] = useState(0);
  const [physicalProduction, setPhysicalProduction] = useState(0);
  const [qtyOpenOrders, setQtyOpenOrders] = useState(0);
  const [comment, setComment] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [unitValueEur, setUnitValueEur] = useState(0);

  // SAP adjustment
  const [sapAdjDoc, setSapAdjDoc] = useState("");
  const [closureComment, setClosureComment] = useState("");

  // Approval
  const [approvalComment, setApprovalComment] = useState("");

  useEffect(() => {
    if (!requestId || !open) return;
    loadData();
  }, [requestId, open]);

  const loadData = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const [r, h] = await Promise.all([
        getInventoryRequest(requestId),
        getInventoryRequestHistory(requestId),
      ]);
      setReq(r);
      setHistory(h);
      setSapHbl(r.sap_hbl);
      setSapProduction(r.sap_production);
      setPhysicalHbl(r.physical_hbl);
      setPhysicalProduction(r.physical_production);
      setQtyOpenOrders(r.qty_open_orders);
      setComment(r.comment ?? "");
      setRootCause(r.root_cause ?? "");
      setSapAdjDoc(r.sap_adjustment_doc ?? "");
      setClosureComment(r.closure_comment ?? "");
      setUnitValueEur(r.unit_value_eur ?? 0);
      setApprovalComment("");
    } catch (e: any) {
      toast({ title: "Error loading request", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Calculated values
  const diffHbl = physicalHbl - sapHbl;
  const diffProduction = physicalProduction - qtyOpenOrders - sapProduction;
  const diffTotal = diffHbl + diffProduction;
  const previewFinancialImpact = diffTotal * unitValueEur;

  const handleSave = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      await updateInventoryRequest(requestId, {
        sap_hbl: sapHbl,
        sap_production: sapProduction,
        physical_hbl: physicalHbl,
        physical_production: physicalProduction,
        qty_open_orders: qtyOpenOrders,
        comment,
        root_cause: rootCause,
        unit_value_eur: unitValueEur,
      });
      toast({ title: "Values saved" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      await reviewInventoryRequest(requestId);
      toast({ title: "Marked as reviewed" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Review failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSapAdjusted = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      await markSapAdjusted(requestId, { sap_adjustment_doc: sapAdjDoc || undefined });
      toast({ title: "SAP adjustment recorded" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "SAP adjustment failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      await closeInventoryRequest(requestId, { closure_comment: closureComment || undefined });
      toast({ title: "Request closed" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Close failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (decision: "APPROVE" | "REJECT") => {
    if (!requestId) return;
    setSaving(true);
    try {
      await submitApprovalDecision(requestId, { decision, approval_comment: approvalComment || undefined });
      toast({ title: decision === "APPROVE" ? "Approved" : "Rejected" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Approval action failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isClosed = req?.status === "CLOSED" || req?.status === "CANCELLED";
  const canApprove = user && (user.username === "george.dumitrache" || user.role === "admin");
  const approvalPending = req?.approval_required && req?.approval_status === "PENDING";
  const approvalBlocked = req?.approval_required && req?.approval_status !== "APPROVED";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                Stock Check #{requestId}
                {req && <Badge className={statusColor(req.status)}>{req.status}</Badge>}
                {req?.approval_required && (
                  <Badge className={approvalStatusColor(req.approval_status)}>
                    {req.approval_status === "PENDING" ? "⏳ Approval Pending" : req.approval_status === "APPROVED" ? "✓ Approved" : req.approval_status === "REJECTED" ? "✗ Rejected" : req.approval_status ?? "N/A"}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {req?.material} — {req?.material_description || "No description"}
              </SheetDescription>
            </SheetHeader>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <RefreshCw size={18} className="animate-spin" /> Loading…
              </div>
            ) : req ? (
              <>
                {/* Section 1: Header Info */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Request Info</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <InfoRow label="Material" value={req.material} />
                    <InfoRow label="Description" value={req.material_description} />
                    <InfoRow label="Plant" value={req.plant} />
                    <InfoRow label="SLoc" value={req.sloc} />
                    <InfoRow label="Requested By" value={req.requested_by} highlight />
                    <InfoRow label="Requested At" value={req.requested_at?.replace("T", " ").slice(0, 19)} />
                    <InfoRow label="Entered By" value={req.entered_by} highlight />
                    <InfoRow label="Updated By" value={req.updated_by} highlight />
                    <InfoRow label="Priority" value={req.priority} />
                    <InfoRow label="Reason" value={req.request_reason} />
                  </div>
                </section>

                <Separator />

                {/* Section 2: Count Values (editable) */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Count Values</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="SAP HBL" value={sapHbl} onChange={setSapHbl} disabled={isClosed} />
                    <NumField label="SAP Production" value={sapProduction} onChange={setSapProduction} disabled={isClosed} />
                    <NumField label="Physical HBL" value={physicalHbl} onChange={setPhysicalHbl} disabled={isClosed} />
                    <NumField label="Physical Production" value={physicalProduction} onChange={setPhysicalProduction} disabled={isClosed} />
                    <NumField label="QTY Open Orders" value={qtyOpenOrders} onChange={setQtyOpenOrders} disabled={isClosed} />
                    <NumField label="Unit Value (EUR)" value={unitValueEur} onChange={setUnitValueEur} disabled={isClosed} step="0.01" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comment</Label>
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} disabled={isClosed} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Root Cause</Label>
                    <Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} disabled={isClosed} />
                  </div>
                  {!isClosed && (
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      {saving ? "Saving…" : "Save Values"}
                    </Button>
                  )}
                </section>

                <Separator />

                {/* Section 3: Variance & Financial Impact */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Variance & Financial Impact</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <ResultCard label="Diff HBL" value={diffHbl} />
                    <ResultCard label="Diff Production" value={diffProduction} />
                    <ResultCard label="Diff Total" value={diffTotal} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border p-3 bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Unit Value (EUR)</div>
                      <div className="text-lg font-bold text-foreground">{unitValueEur.toFixed(2)} €</div>
                    </div>
                    <div className={`rounded-md border p-3 ${Math.abs(previewFinancialImpact) > 50 ? "bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/20" : "bg-muted/30"}`}>
                      <div className="text-xs text-muted-foreground mb-1">Financial Impact (EUR)</div>
                      <div className={`text-lg font-bold ${Math.abs(previewFinancialImpact) > 50 ? "text-[hsl(var(--destructive))]" : "text-foreground"}`}>
                        {previewFinancialImpact.toFixed(2)} €
                      </div>
                      {req.financial_impact_eur != null && req.financial_impact_eur !== previewFinancialImpact && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">Saved: {req.financial_impact_eur.toFixed(2)} €</div>
                      )}
                    </div>
                  </div>
                  {Math.abs(req.financial_impact_eur ?? previewFinancialImpact) > 50 && (
                    <div className="flex items-center gap-2 text-xs rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2">
                      <AlertTriangle size={14} className="text-[hsl(var(--warning))] shrink-0" />
                      <span className="text-[hsl(var(--warning-foreground))]">Plant Manager approval required for impacts above 50 EUR.</span>
                    </div>
                  )}
                </section>

                <Separator />

                {/* Section 4: Financial Approval */}
                {req.approval_required && (
                  <>
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Financial Approval</h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                        <InfoRow label="Approval Required" value={req.approval_required ? "Yes" : "No"} />
                        <div>
                          <span className="text-muted-foreground">Approval Status: </span>
                          <Badge className={`${approvalStatusColor(req.approval_status)} text-[10px]`}>
                            {req.approval_status?.replace(/_/g, " ") ?? "—"}
                          </Badge>
                        </div>
                        <InfoRow label="Approver" value={req.approver_username} highlight />
                        <InfoRow label="Requested At" value={req.approval_requested_at?.replace("T", " ").slice(0, 19)} />
                        <InfoRow label="Approved By" value={req.approved_by} highlight />
                        <InfoRow label="Approved At" value={req.approved_at?.replace("T", " ").slice(0, 19)} />
                        {req.approval_comment && <InfoRow label="Comment" value={req.approval_comment} />}
                      </div>

                      {approvalPending && canApprove && (
                        <div className="space-y-2 pt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Approval Comment</Label>
                            <Textarea value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} rows={2} placeholder="Optional comment…" />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleApproval("APPROVE")} disabled={saving} size="sm" className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]">
                              <ShieldCheck size={14} /> Approve
                            </Button>
                            <Button onClick={() => handleApproval("REJECT")} disabled={saving} size="sm" variant="destructive">
                              <ShieldX size={14} /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>
                    <Separator />
                  </>
                )}

                {/* Section 5: SAP Adjustment & Close */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">SAP Adjustment & Closure</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">SAP Adjusted:</span>
                    <Badge className={req.sap_adjusted ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : "bg-muted text-muted-foreground"}>
                      {req.sap_adjusted ? "Yes" : "No"}
                    </Badge>
                    {req.sap_adjusted_by && <span className="text-xs text-muted-foreground">by {req.sap_adjusted_by}</span>}
                  </div>

                  {approvalBlocked && !isClosed && (
                    <div className="flex items-center gap-2 text-xs rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2">
                      <AlertTriangle size={14} className="text-[hsl(var(--warning))] shrink-0" />
                      <span className="text-[hsl(var(--warning-foreground))]">Plant Manager approval is required before SAP adjustment/closure for impacts above 50 EUR.</span>
                    </div>
                  )}

                  {!isClosed && (
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">SAP Adjustment Doc</Label>
                        <Input value={sapAdjDoc} onChange={(e) => setSapAdjDoc(e.target.value)} placeholder="Document reference" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={handleReview} disabled={saving} size="sm" variant="outline">
                          <ClipboardCheck size={14} /> Mark Reviewed
                        </Button>
                        <Button onClick={handleSapAdjusted} disabled={saving || !!approvalBlocked} size="sm" variant="outline" title={approvalBlocked ? "Approval required first" : undefined}>
                          <FileCheck2 size={14} /> Mark SAP Adjusted
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Closure Comment</Label>
                        <Textarea value={closureComment} onChange={(e) => setClosureComment(e.target.value)} rows={2} />
                      </div>
                      <Button onClick={handleClose} disabled={saving || !!approvalBlocked} size="sm" variant="destructive" title={approvalBlocked ? "Approval required first" : undefined}>
                        <XCircle size={14} /> Close Request
                      </Button>
                    </div>
                  )}
                </section>

                <Separator />

                {/* Section 6: History */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Audit History</h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No history entries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div key={h.history_id} className="text-xs border rounded-md p-2 bg-muted/30 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{h.action}</span>
                            <span className="text-muted-foreground">{h.changed_at?.replace("T", " ").slice(0, 19)}</span>
                          </div>
                          {h.changed_by && <div className="text-muted-foreground">by {h.changed_by}</div>}
                          {h.details && <div className="text-muted-foreground">{h.details}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={`font-medium ${highlight && value ? "text-primary" : "text-foreground"}`}>{value || "—"}</span>
    </div>
  );
}

function NumField({ label, value, onChange, disabled, step }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="h-8 text-sm"
        step={step}
      />
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  const color = value === 0
    ? "text-[hsl(var(--success))]"
    : "text-[hsl(var(--destructive))]";
  const bg = value === 0
    ? "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/20"
    : "bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/20";
  return (
    <div className={`rounded-md border p-3 text-center ${bg}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
