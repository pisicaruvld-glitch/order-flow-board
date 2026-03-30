import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryRequests, type InventoryRequest } from "@/lib/inventoryApi";
import { CreateInventoryRequestDialog } from "@/components/CreateInventoryRequestDialog";
import { InventoryRequestDetail } from "@/components/InventoryRequestDetail";

const STATUSES = ["ALL", "REQUESTED", "COUNTED", "REVIEWED", "ADJUSTED_IN_SAP", "CLOSED", "CANCELLED"] as const;
const SAP_ADJ_OPTIONS = ["ALL", "YES", "NO"] as const;

export function statusColor(status: string): string {
  switch (status) {
    case "REQUESTED": return "bg-muted text-muted-foreground";
    case "COUNTED": return "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]";
    case "REVIEWED": return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
    case "ADJUSTED_IN_SAP": return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
    case "CLOSED": return "bg-foreground/80 text-background";
    case "CANCELLED": return "bg-muted text-muted-foreground opacity-60";
    default: return "bg-muted text-muted-foreground";
  }
}

export function diffColor(val: number): string {
  return val === 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))] font-semibold";
}

export default function StockCheckRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sapAdjFilter, setSapAdjFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ["inventory-requests"],
    queryFn: getInventoryRequests,
  });

  const filtered = useMemo(() => {
    let list = requests ?? [];
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    if (sapAdjFilter === "YES") list = list.filter((r) => r.sap_adjusted);
    if (sapAdjFilter === "NO") list = list.filter((r) => !r.sap_adjusted);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.material?.toLowerCase().includes(q) ||
          r.material_description?.toLowerCase().includes(q) ||
          r.requested_by?.toLowerCase().includes(q)
      );
    }
    // Sort newest first
    return [...list].sort((a, b) => (b.requested_at ?? "").localeCompare(a.requested_at ?? ""));
  }, [requests, statusFilter, sapAdjFilter, search]);

  const openDetail = (id: number) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Check Requests"
        subtitle="Track warehouse stock verification and SAP reconciliation"
        actions={<CreateInventoryRequestDialog onCreated={() => refetch()} />}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search material / description / user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 h-9"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sapAdjFilter} onValueChange={setSapAdjFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="SAP Adjusted" /></SelectTrigger>
          <SelectContent>
            {SAP_ADJ_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "SAP Adj: All" : `SAP Adj: ${s}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner label="Loading stock check requests…" />
      ) : error ? (
        <ErrorMessage message={(error as Error).message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No stock check requests found.</div>
      ) : (
        <div className="border rounded-lg overflow-auto bg-card">
          <Table>
            <TableHeader>
              <TableRow>
             <TableHead className="w-16">ID</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead className="w-20">Plant</TableHead>
                <TableHead className="w-20 hidden md:table-cell">SLoc</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="hidden md:table-cell">Entered By</TableHead>
                <TableHead className="hidden lg:table-cell">Updated By</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20 text-center">SAP Adj</TableHead>
                <TableHead className="w-20 text-right">Diff Total</TableHead>
                <TableHead className="w-24 text-right hidden md:table-cell">Impact EUR</TableHead>
                <TableHead className="w-28 hidden md:table-cell">Approval</TableHead>
                <TableHead className="w-36 hidden xl:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.request_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(r.request_id)}
                >
                  <TableCell className="font-mono text-xs">{r.request_id}</TableCell>
                  <TableCell className="font-medium">{r.material}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{r.material_description || "—"}</TableCell>
                  <TableCell className="text-xs">{r.plant || "—"}</TableCell>
                  <TableCell className="text-xs hidden md:table-cell">{r.sloc || "—"}</TableCell>
                  <TableCell className="text-xs">{r.requested_by}</TableCell>
                  <TableCell className="text-xs hidden md:table-cell font-medium">{r.entered_by || "—"}</TableCell>
                  <TableCell className="text-xs hidden lg:table-cell font-medium">{r.updated_by || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${statusColor(r.status)}`}>{r.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={r.sap_adjusted ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                      {r.sap_adjusted ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right text-xs ${diffColor(r.diff_total)}`}>{r.diff_total}</TableCell>
                  <TableCell className={`text-right text-xs hidden md:table-cell ${r.financial_impact_eur != null && Math.abs(r.financial_impact_eur) > 50 ? "text-[hsl(var(--destructive))] font-semibold" : "text-foreground"}`}>
                    {r.financial_impact_eur != null ? `${r.financial_impact_eur.toFixed(2)} €` : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.approval_required ? (
                      <Badge className={`text-[10px] ${r.approval_status === "APPROVED" ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : r.approval_status === "REJECTED" ? "bg-destructive text-destructive-foreground" : r.approval_status === "PENDING" ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]" : "bg-muted text-muted-foreground"}`}>
                        {r.approval_status?.replace(/_/g, " ") ?? "—"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">{r.updated_at?.replace("T", " ").slice(0, 16)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InventoryRequestDetail
        requestId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={() => refetch()}
      />
    </PageContainer>
  );
}
