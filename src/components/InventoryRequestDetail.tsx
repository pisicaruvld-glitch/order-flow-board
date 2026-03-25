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
import {
  getInventoryRequest,
  updateInventoryRequest,
  reviewInventoryRequest,
  markSapAdjusted,
  closeInventoryRequest,
  getInventoryRequestHistory,
  type InventoryRequest,
  type InventoryHistoryEntry,
} from "@/lib/inventoryApi";
import { statusColor, diffColor } from "@/pages/StockCheckRequests";
import { RefreshCw, CheckCircle2, ClipboardCheck, FileCheck2, XCircle } from "lucide-react";

interface Props {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function InventoryRequestDetail({ requestId, open, onOpenChange, onUpdated }: Props) {
  const [req, setReq] = useState<InventoryRequest | null>(null);
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Editable count fields
  const [sapHbl, setSapHbl] = useState(0);
  const [sapProduction, setSapProduction] = useState(0);
  const [physicalHbl, setPhysicalHbl] = useState(0);
  const [physicalProduction, setPhysicalProduction] = useState(0);
  const [qtyOpenOrders, setQtyOpenOrders] = useState(0);
  const [comment, setComment] = useState("");
  const [rootCause, setRootCause] = useState("");

  // SAP adjustment
  const [sapAdjDoc, setSapAdjDoc] = useState("");
  const [closureComment, setClosureComment] = useState("");

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
      await reviewInventoryRequest(requestId, { reviewed_by: "current_user" });
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
      await markSapAdjusted(requestId, { sap_adjusted_by: "current_user", sap_adjustment_doc: sapAdjDoc || undefined });
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
      await closeInventoryRequest(requestId, { closed_by: "current_user", closure_comment: closureComment || undefined });
      toast({ title: "Request closed" });
      await loadData();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Close failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isClosed = req?.status === "CLOSED" || req?.status === "CANCELLED";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Stock Check #{requestId}
                {req && <Badge className={statusColor(req.status)}>{req.status}</Badge>}
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
                    <InfoRow label="Requested By" value={req.requested_by} />
                    <InfoRow label="Requested At" value={req.requested_at?.replace("T", " ").slice(0, 19)} />
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

                {/* Section 3: Calculated Results */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Variance Results</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <ResultCard label="Diff HBL" value={diffHbl} />
                    <ResultCard label="Diff Production" value={diffProduction} />
                    <ResultCard label="Diff Total" value={diffTotal} />
                  </div>
                </section>

                <Separator />

                {/* Section 4: SAP Adjustment & Close */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">SAP Adjustment & Closure</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">SAP Adjusted:</span>
                    <Badge className={req.sap_adjusted ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : "bg-muted text-muted-foreground"}>
                      {req.sap_adjusted ? "Yes" : "No"}
                    </Badge>
                    {req.sap_adjusted_by && <span className="text-xs text-muted-foreground">by {req.sap_adjusted_by}</span>}
                  </div>
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
                        <Button onClick={handleSapAdjusted} disabled={saving} size="sm" variant="outline">
                          <FileCheck2 size={14} /> Mark SAP Adjusted
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Closure Comment</Label>
                        <Textarea value={closureComment} onChange={(e) => setClosureComment(e.target.value)} rows={2} />
                      </div>
                      <Button onClick={handleClose} disabled={saving} size="sm" variant="destructive">
                        <XCircle size={14} /> Close Request
                      </Button>
                    </div>
                  )}
                </section>

                <Separator />

                {/* Section 5: History */}
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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="h-8 text-sm"
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
