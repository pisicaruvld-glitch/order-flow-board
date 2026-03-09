import { useState, useMemo, useCallback } from "react";
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, X, Copy, ArrowUpDown, Filter, ChevronDown, ChevronUp,
  Package, Truck, Factory, Warehouse as WarehouseIcon, ShoppingCart,
  AlertTriangle, Clock, Upload, ArrowRight, FileText, Box,
  CheckCircle2, XCircle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getOrderHistory,
  getComponentHistory,
  OrderHistoryResponse,
  ComponentHistoryResponse,
  HistoryEvent,
  HistoryIssue,
  HistoryIssueHistoryEntry,
} from "@/lib/historyApi";
import { AppConfig } from "@/lib/types";
import { format } from "date-fns";

// ============================================================
// Helpers
// ============================================================
function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yyyy HH:mm");
  } catch {
    return d;
  }
}

function fmtShortDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yyyy");
  } catch {
    return d;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

const EVENT_ICONS: Record<string, any> = {
  UPLOAD_CHANGE: Upload,
  SNAPSHOT_REVISION: FileText,
  FLOW_MOVE: ArrowRight,
  ISSUE: AlertTriangle,
  ISSUE_HISTORY: Clock,
  PRODUCTION_STATUS: Factory,
  PROD_TO_LOG: Truck,
  LOG_RECEIVE: Package,
  CUSTOMER_SHIP: ShoppingCart,
  SHIPMENT: Truck,
  PALLET: Box,
};

const EVENT_COLORS: Record<string, string> = {
  UPLOAD_CHANGE: "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]",
  SNAPSHOT_REVISION: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  FLOW_MOVE: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  ISSUE: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
  ISSUE_HISTORY: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  PRODUCTION_STATUS: "bg-[hsl(var(--status-production))] text-white",
  PROD_TO_LOG: "bg-[hsl(var(--status-logistics))] text-white",
  LOG_RECEIVE: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  CUSTOMER_SHIP: "bg-[hsl(var(--status-orders))] text-white",
  SHIPMENT: "bg-[hsl(var(--status-warehouse))] text-white",
  PALLET: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
};

function AreaBadge({ area }: { area?: string | null }) {
  if (!area) return null;
  const cls =
    area === "Orders" ? "area-orders" :
    area === "Warehouse" ? "area-warehouse" :
    area === "Production" ? "area-production" :
    area === "Logistics" ? "area-logistics" :
    "bg-muted text-muted-foreground";
  return <span className={cn("px-2 py-0.5 rounded text-xs font-medium", cls)}>{area}</span>;
}

function ValOrDash({ v }: { v: any }) {
  return <>{v != null && v !== "" ? String(v) : "—"}</>;
}

// ============================================================
// Main History Page
// ============================================================
export default function HistoryPage({ config }: { config: AppConfig }) {
  return (
    <PageContainer>
      <PageHeader title="History" subtitle="Investigate order lifecycle and component traceability" />
      <Tabs defaultValue="order" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="order">Order History</TabsTrigger>
          <TabsTrigger value="component">Component History</TabsTrigger>
        </TabsList>
        <TabsContent value="order"><OrderHistoryTab config={config} /></TabsContent>
        <TabsContent value="component"><ComponentHistoryTab /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// ============================================================
// ORDER HISTORY TAB
// ============================================================
function OrderHistoryTab({ config }: { config: AppConfig }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<OrderHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Event stream controls
  const [sortNewest, setSortNewest] = useState(false);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [expandAll, setExpandAll] = useState(false);

  const doSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await getOrderHistory(trimmed);
      setData(result);
    } catch (e: any) {
      setError(e.message || "Failed to fetch order history");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") doSearch(); };

  // Filtered / sorted events
  const events = useMemo(() => {
    if (!data?.events) return [];
    let list = [...data.events];
    if (eventFilter) list = list.filter(ev => ev.event_type === eventFilter);
    if (eventSearch) {
      const q = eventSearch.toLowerCase();
      list = list.filter(ev =>
        ev.title?.toLowerCase().includes(q) ||
        JSON.stringify(ev.details ?? {}).toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const diff = new Date(a.event_at).getTime() - new Date(b.event_at).getTime();
      return sortNewest ? -diff : diff;
    });
    return list;
  }, [data, sortNewest, eventFilter, eventSearch]);

  const eventTypes = useMemo(() => {
    if (!data?.events) return [];
    return [...new Set(data.events.map(e => e.event_type))];
  }, [data]);

  const o = data?.order;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter Order number…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="pl-9 pr-9"
          />
          {query && (
            <button onClick={() => { setQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <Button onClick={doSearch} disabled={!query.trim() || loading} size="sm">Search</Button>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && <ErrorMessage message={error} onRetry={doSearch} />}

      {!loading && !error && !searched && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Search size={32} />
          <p className="text-sm">Enter an Order number to see its full history</p>
        </div>
      )}

      {!loading && !error && searched && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Info size={32} />
          <p className="text-sm">No data found</p>
        </div>
      )}

      {data && o && (
        <div className="space-y-6">
          {/* A) Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Order {o.Order ?? o.order ?? data.order_id}</CardTitle>
                <button onClick={() => copyToClipboard(o.Order ?? o.order ?? data.order_id)} className="text-muted-foreground hover:text-foreground" title="Copy order number">
                  <Copy size={14} />
                </button>
                {o.removed_from_current_orders && <Badge variant="destructive" className="text-xs">Removed</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                <KV label="Material" value={o.Material} />
                <KV label="Description" value={o.Material_description} className="sm:col-span-2" />
                <KV label="Plant" value={o.Plant} />
                <KV label="Current Area" value={<AreaBadge area={o.current_area} />} />
                <KV label="Label" value={o.current_label} />
                <KV label="SAP Area" value={<AreaBadge area={o.sap_area} />} />
                <KV label="Source" value={o.source} />
                <KV label="Product Type" value={o.product_type} />
                <KV label="Order Qty" value={o.Order_quantity} />
                <KV label="Delivered Qty" value={o.Delivered_quantity} />
                <KV label="Prod Delivered" value={o.prod_delivered_qty} />
                <KV label="Prod Scrap" value={o.prod_scrap_qty} />
                <KV label="Finished" value={o.finished_qty} />
                <KV label="Log Received" value={o.log_received_qty} />
                {o.log_shipped_qty != null && <KV label="Log Shipped" value={o.log_shipped_qty} />}
              </div>
            </CardContent>
          </Card>

          {/* Section badges/counts */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline">{data.events?.length ?? 0} events</Badge>
            <Badge variant="outline">{data.upload_changes?.length ?? 0} upload changes</Badge>
            <Badge variant="outline">{data.issues?.length ?? 0} issues</Badge>
            <Badge variant="outline">{data.shipments?.length ?? 0} shipments</Badge>
            <Badge variant="outline">{data.pallets?.length ?? 0} pallets</Badge>
          </div>

          {/* B) Event Stream */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Event Stream</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input placeholder="Search events…" value={eventSearch} onChange={e => setEventSearch(e.target.value)} className="h-8 w-40 text-xs" />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSortNewest(!sortNewest)}>
                    <ArrowUpDown size={12} className="mr-1" />{sortNewest ? "Newest first" : "Oldest first"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setExpandAll(!expandAll)}>
                    {expandAll ? <ChevronUp size={12} className="mr-1" /> : <ChevronDown size={12} className="mr-1" />}
                    {expandAll ? "Collapse" : "Expand"}
                  </Button>
                </div>
              </div>
              {/* Event type filters */}
              {eventTypes.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  <button onClick={() => setEventFilter(null)} className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors", !eventFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>All</button>
                  {eventTypes.map(t => (
                    <button key={t} onClick={() => setEventFilter(eventFilter === t ? null : t)} className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors", eventFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{t}</button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No events found</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-border space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
                  {events.map((ev, i) => (
                    <EventCard key={i} event={ev} defaultOpen={expandAll} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* C) SAP Upload Changes */}
          {(data.upload_changes?.length ?? 0) > 0 && (
            <CollapsibleSection title="SAP Upload Changes" count={data.upload_changes.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Uploaded At</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Changed Fields</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.upload_changes.map((uc, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(uc.uploaded_at)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{uc.change_type}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(uc.changed_fields ?? []).map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs"><KVBlock obj={uc.before_values} /></TableCell>
                        <TableCell className="text-xs"><KVBlock obj={uc.after_values} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}

          {/* D) Snapshot Timeline */}
          {(data.timeline?.entries?.length ?? 0) > 0 && (
            <CollapsibleSection title="Snapshot Timeline" count={data.timeline.entries.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Finish</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>User Status</TableHead>
                      <TableHead>Delivered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.timeline.entries.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{e.version_label ?? `v${i + 1}`}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.uploaded_at)}</TableCell>
                        <TableCell className="text-xs">{fmtShortDate(e.Start_date_sched)}</TableCell>
                        <TableCell className="text-xs">{fmtShortDate(e.Scheduled_finish_date)}</TableCell>
                        <TableCell className="text-xs">{e.Order_quantity ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{e.System_Status ?? "—"}</TableCell>
                        <TableCell className="text-xs">{e.User_Status ?? "—"}</TableCell>
                        <TableCell className="text-xs">{e.Delivered_quantity ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}

          {/* E) Flow History */}
          {(data.flow_history?.length ?? 0) > 0 && (
            <CollapsibleSection title="Flow History" count={data.flow_history.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.flow_history.map((fh, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(fh.changed_at)}</TableCell>
                        <TableCell><AreaBadge area={fh.from_area} />{fh.from_label && <span className="text-xs text-muted-foreground ml-1">{fh.from_label}</span>}</TableCell>
                        <TableCell><AreaBadge area={fh.to_area} />{fh.to_label && <span className="text-xs text-muted-foreground ml-1">{fh.to_label}</span>}</TableCell>
                        <TableCell className="text-xs">{fh.action}</TableCell>
                        <TableCell className="text-xs">{fh.changed_by ?? "—"}</TableCell>
                        <TableCell className="text-xs">{fh.note ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}

          {/* F) Issues */}
          {(data.issues?.length ?? 0) > 0 && (
            <CollapsibleSection title="Issues" count={data.issues.length}>
              <IssuesTable issues={data.issues} issueHistory={data.issue_history} />
            </CollapsibleSection>
          )}

          {/* G) Logistics / Shipments / Pallets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Production Status */}
            {data.production_status && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Production Status</CardTitle></CardHeader>
                <CardContent><KVBlock obj={data.production_status} /></CardContent>
              </Card>
            )}
            {/* Logistics Status */}
            {data.logistics_status && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Logistics Status</CardTitle></CardHeader>
                <CardContent><KVBlock obj={data.logistics_status} /></CardContent>
              </Card>
            )}
          </div>

          {(data.shipments?.length ?? 0) > 0 && (
            <CollapsibleSection title="Shipments" count={data.shipments.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Scrap</TableHead>
                      <TableHead>Finished</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead>Reported</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Doc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.shipments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-mono">{s.id}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.shipment_type ?? "—"}</Badge></TableCell>
                        <TableCell className="text-xs"><ValOrDash v={s.delivered_qty_delta} /></TableCell>
                        <TableCell className="text-xs"><ValOrDash v={s.scrap_qty_delta} /></TableCell>
                        <TableCell className="text-xs"><ValOrDash v={s.finished_qty_delta} /></TableCell>
                        <TableCell className="text-xs">{s.received_qty_delta ?? "—"} {s.received_at && <span className="text-muted-foreground">({fmtDate(s.received_at)})</span>}</TableCell>
                        <TableCell className="text-xs">{s.shipped_qty_delta ?? "—"} {s.shipped_at && <span className="text-muted-foreground">({fmtDate(s.shipped_at)})</span>}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.reported_at)}</TableCell>
                        <TableCell className="text-xs">{s.reported_by ?? s.received_by ?? s.shipped_by ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s.shipped_doc ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}

          {(data.pallets?.length ?? 0) > 0 && (
            <CollapsibleSection title="Pallets" count={data.pallets.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pallet No</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead>Shipped By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pallets.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{p.pallet_no}</TableCell>
                        <TableCell><Badge variant={p.status === "SHIPPED" ? "default" : "outline"} className="text-xs">{p.status ?? "—"}</Badge></TableCell>
                        <TableCell className="text-xs">{p.qty_on_pallet ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(p.created_at)}</TableCell>
                        <TableCell className="text-xs">{p.created_by ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(p.shipped_at)}</TableCell>
                        <TableCell className="text-xs">{p.shipped_by ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT HISTORY TAB
// ============================================================
function ComponentHistoryTab() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ComponentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await getComponentHistory(trimmed);
      setData(result);
    } catch (e: any) {
      setError(e.message || "Failed to fetch component history");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") doSearch(); };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Enter Component PN…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey} className="pl-9 pr-9" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
          )}
        </div>
        <Button onClick={doSearch} disabled={!query.trim() || loading} size="sm">Search</Button>
      </div>

      {loading && <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>}
      {!loading && error && <ErrorMessage message={error} onRetry={doSearch} />}
      {!loading && !error && !searched && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Search size={32} /><p className="text-sm">Enter a Component PN to investigate</p>
        </div>
      )}
      {!loading && !error && searched && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Info size={32} /><p className="text-sm">No data found</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* A) Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Component</span>
                  <button onClick={() => copyToClipboard(data.component_pn)} className="text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
                </div>
                <span className="text-lg font-bold font-mono">{data.component_pn}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex flex-col items-center">
                <span className="text-sm font-medium text-muted-foreground">Occurrences</span>
                <span className="text-2xl font-bold">{data.occurrences ?? 0}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex flex-col items-center">
                <span className="text-sm font-medium text-muted-foreground">Impacted Orders</span>
                <span className="text-2xl font-bold">{data.orders?.length ?? 0}</span>
              </CardContent>
            </Card>
          </div>

          {/* B) Impacted Orders */}
          {(data.orders?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Impacted Orders</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1.5 flex-wrap">
                  {data.orders.map(oid => (
                    <Badge key={oid} variant="outline" className="font-mono text-xs">{oid}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* C) Issues Table */}
          {(data.issues?.length ?? 0) > 0 && (
            <CollapsibleSection title="Issues" count={data.issues.length} defaultOpen>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue Code</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>PN</TableHead>
                      <TableHead>FG No</TableHead>
                      <TableHead>FG Description</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>SAP Area</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.issues.map((iss, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono">{iss.issue_code ?? iss.id ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{iss.order_id ?? "—"}</TableCell>
                        <TableCell className="text-xs">{iss.pn ?? "—"}</TableCell>
                        <TableCell className="text-xs">{iss.finish_good_no ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{iss.finish_good_description ?? "—"}</TableCell>
                        <TableCell className="text-xs">{iss.Plant ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{iss.issue_type ?? "—"}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{iss.comment ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={iss.status === "OPEN" ? "destructive" : "secondary"} className="text-xs">{iss.status ?? "—"}</Badge>
                        </TableCell>
                        <TableCell><AreaBadge area={iss.current_area} /></TableCell>
                        <TableCell><AreaBadge area={iss.sap_area} /></TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(iss.created_at)}</TableCell>
                        <TableCell className="text-xs">{iss.created_by ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}

          {/* D) Issue History */}
          {(data.issue_history?.length ?? 0) > 0 && (
            <CollapsibleSection title="Issue History" count={data.issue_history.length}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue ID</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.issue_history.map((ih, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono">{ih.issue_id ?? "—"}</TableCell>
                        <TableCell className="text-xs">{ih.action}</TableCell>
                        <TableCell className="text-xs">{ih.changed_by}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(ih.changed_at)}</TableCell>
                        <TableCell className="text-xs">{ih.details ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared Components
// ============================================================
function KV({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{typeof value === "object" && value !== null && !Array.isArray(value) ? value : <ValOrDash v={value} />}</div>
    </div>
  );
}

function KVBlock({ obj }: { obj?: Record<string, any> | null }) {
  if (!obj || Object.keys(obj).length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-muted-foreground shrink-0">{k}:</span>
          <span className="font-medium">{v != null ? String(v) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function EventCard({ event, defaultOpen }: { event: HistoryEvent; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = EVENT_ICONS[event.event_type] ?? Clock;
  const colorCls = EVENT_COLORS[event.event_type] ?? "bg-muted text-muted-foreground";
  const hasDetails = event.details && Object.keys(event.details).length > 0;

  // Sync with parent expand/collapse
  useMemo(() => { setOpen(defaultOpen); }, [defaultOpen]);

  return (
    <div className="relative">
      {/* Dot on timeline */}
      <div className={cn("absolute -left-[calc(0.75rem+5px)] w-3 h-3 rounded-full border-2 border-background", colorCls)} />
      <div className="ml-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(event.event_at)}</span>
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium", colorCls)}>
            <Icon size={10} />{event.event_type}
          </span>
        </div>
        <button
          onClick={() => hasDetails && setOpen(!open)}
          className={cn("text-sm font-medium text-left", hasDetails && "cursor-pointer hover:text-primary")}
        >
          {event.title}
          {hasDetails && <ChevronDown size={12} className={cn("inline ml-1 transition-transform", open && "rotate-180")} />}
        </button>
        {open && hasDetails && (
          <div className="mt-1 p-2 rounded bg-muted/50 text-xs">
            <KVBlock obj={event.details} />
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, count, children, defaultOpen = false }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? title : undefined}>
      <AccordionItem value={title} className="border rounded-lg overflow-hidden">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function IssuesTable({ issues, issueHistory }: { issues: HistoryIssue[]; issueHistory: HistoryIssueHistoryEntry[] }) {
  return (
    <div className="space-y-3">
      {issues.map((iss, i) => {
        const relHistory = (issueHistory ?? []).filter(ih => ih.issue_id === iss.id);
        return (
          <Card key={i} className="shadow-none border">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                <KV label="Issue Code" value={iss.issue_code ?? iss.id} />
                <KV label="PN" value={iss.pn} />
                <KV label="Type" value={iss.issue_type} />
                <KV label="Status" value={<Badge variant={iss.status === "OPEN" ? "destructive" : "secondary"} className="text-xs">{iss.status}</Badge>} />
                <KV label="Comment" value={iss.comment} className="col-span-2" />
                <KV label="Created" value={fmtDate(iss.created_at)} />
                <KV label="By" value={iss.created_by} />
              </div>
              {relHistory.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="history" className="border-t pt-2">
                    <AccordionTrigger className="py-1 text-xs hover:no-underline">Issue History ({relHistory.length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 mt-1">
                        {relHistory.map((ih, j) => (
                          <div key={j} className="flex items-center gap-3 text-xs py-1 border-b last:border-0">
                            <span className="text-muted-foreground whitespace-nowrap">{fmtDate(ih.changed_at)}</span>
                            <Badge variant="outline" className="text-xs">{ih.action}</Badge>
                            <span>{ih.changed_by}</span>
                            <span className="text-muted-foreground">{ih.details ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
