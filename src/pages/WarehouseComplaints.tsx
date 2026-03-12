import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getWarehouseComplaints, patchComplaint, getComplaintHistory,
  Complaint, ComplaintHistoryEntry, ComplaintStatus, ComplaintSeverity,
  COMPLAINT_TYPES, COMPLAINT_SEVERITIES, PatchComplaintPayload,
} from '@/lib/complaintsApi';
import { PageContainer, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ComplaintBadge } from '@/components/ComplaintBadge';
import { Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Loader2, History, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type StatusFilterValue = 'ALL' | ComplaintStatus;
type SeverityFilterValue = 'ALL' | ComplaintSeverity;

export default function WarehouseComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilterValue>('ALL');
  const [search, setSearch] = useState('');
  const [detailComplaint, setDetailComplaint] = useState<Complaint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComplaints(await getWarehouseComplaints());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = [...complaints];
    if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter);
    if (severityFilter !== 'ALL') result = result.filter(c => c.severity === severityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(c =>
        c.order_id?.toLowerCase().includes(q) ||
        c.finish_good_no?.toLowerCase().includes(q) ||
        c.finish_good_description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [complaints, statusFilter, severityFilter, search]);

  const kpis = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter(c => c.status === 'OPEN').length,
    inReview: complaints.filter(c => c.status === 'IN_REVIEW').length,
    high: complaints.filter(c => c.severity === 'HIGH').length,
  }), [complaints]);

  const handleStatusChange = async (complaint: Complaint, newStatus: ComplaintStatus) => {
    try {
      const updated = await patchComplaint(complaint.complaint_id, { status: newStatus });
      setComplaints(prev => prev.map(c => c.complaint_id === complaint.complaint_id ? { ...c, ...updated } : c));
      toast.success(`Complaint status changed to ${newStatus}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Warehouse Complaints</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complaints raised by Production against Warehouse</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total" value={kpis.total} color="text-muted-foreground" />
        <KpiCard label="Open" value={kpis.open} color="text-destructive" />
        <KpiCard label="In Review" value={kpis.inReview} color="text-warning" />
        <KpiCard label="High Severity" value={kpis.high} color="text-destructive" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order / material…" className="pl-8 h-9 w-56 text-sm" />
        </div>
        <FilterGroup label="Status" value={statusFilter} options={['ALL', 'OPEN', 'IN_REVIEW', 'CLOSED']} onChange={v => setStatusFilter(v as StatusFilterValue)} />
        <FilterGroup label="Severity" value={severityFilter} options={['ALL', 'HIGH', 'MEDIUM', 'LOW']} onChange={v => setSeverityFilter(v as SeverityFilterValue)} />
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {kpis.total}</span>
      </div>

      {loading && <LoadingSpinner label="Loading complaints…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-16">ID</TableHead>
                <TableHead className="w-28">Order</TableHead>
                <TableHead className="w-28">FG No</TableHead>
                <TableHead>FG Description</TableHead>
                <TableHead className="w-24">Area</TableHead>
                <TableHead className="w-36">Type</TableHead>
                <TableHead className="w-20">Severity</TableHead>
                <TableHead className="w-24">Raised by</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36">Created</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">No complaints found</TableCell></TableRow>
              )}
              {filtered.map(c => (
                <TableRow key={c.complaint_id} className={cn(
                  'transition-colors',
                  c.severity === 'HIGH' && 'bg-destructive/5',
                  c.severity === 'MEDIUM' && 'bg-warning/5',
                  c.status === 'CLOSED' && 'opacity-60',
                )}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.complaint_id}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{c.order_id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.finish_good_no || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={c.finish_good_description}>{c.finish_good_description || '—'}</TableCell>
                  <TableCell className="text-xs">{c.current_area || '—'}</TableCell>
                  <TableCell className="text-xs">{COMPLAINT_TYPES.find(t => t.value === c.complaint_type)?.label ?? c.complaint_type}</TableCell>
                  <TableCell><ComplaintBadge count={1} severity={c.severity} /></TableCell>
                  <TableCell className="text-xs">{c.raised_by_username || '—'}</TableCell>
                  <TableCell>
                    <select
                      value={c.status}
                      onChange={e => handleStatusChange(c, e.target.value as ComplaintStatus)}
                      disabled={c.status === 'CLOSED'}
                      className={cn(
                        'text-xs border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring',
                        c.status === 'OPEN' && 'border-destructive/30 text-destructive',
                        c.status === 'IN_REVIEW' && 'border-warning/30 text-warning',
                        c.status === 'CLOSED' && 'border-success/30 text-success',
                      )}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setDetailComplaint(c)}>
                      <Eye size={12} /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      {detailComplaint && (
        <ComplaintDetailDialog
          complaint={detailComplaint}
          onClose={() => setDetailComplaint(null)}
          onStatusChange={(status) => {
            handleStatusChange(detailComplaint, status);
            setDetailComplaint(prev => prev ? { ...prev, status } : null);
          }}
        />
      )}
    </PageContainer>
  );
}

// ============================================================
function ComplaintDetailDialog({ complaint, onClose, onStatusChange }: {
  complaint: Complaint;
  onClose: () => void;
  onStatusChange: (status: ComplaintStatus) => void;
}) {
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [statusComment, setStatusComment] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoadingHistory(true);
    getComplaintHistory(complaint.complaint_id)
      .then(setHistory)
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoadingHistory(false));
  }, [complaint.complaint_id]);

  const handleStatusUpdate = async (newStatus: ComplaintStatus) => {
    setUpdating(true);
    try {
      await patchComplaint(complaint.complaint_id, {
        status: newStatus,
        comment: statusComment.trim() || undefined,
        changed_by: changedBy.trim() || undefined,
      });
      onStatusChange(newStatus);
      toast.success(`Status updated to ${newStatus}`);
      // Reload history
      const h = await getComplaintHistory(complaint.complaint_id);
      setHistory(h);
      setStatusComment('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complaint #{complaint.complaint_id} — Order {complaint.order_id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Type" value={COMPLAINT_TYPES.find(t => t.value === complaint.complaint_type)?.label ?? complaint.complaint_type} />
            <Field label="Severity" value={complaint.severity} />
            <Field label="Status" value={complaint.status} />
            <Field label="Raised by" value={complaint.raised_by_username || '—'} />
            <div className="col-span-2"><Field label="Comment" value={complaint.comment} /></div>
            <Field label="FG No" value={complaint.finish_good_no || '—'} />
            <Field label="FG Description" value={complaint.finish_good_description || '—'} />
            <Field label="Created" value={complaint.created_at ? new Date(complaint.created_at).toLocaleString() : '—'} />
          </div>

          {/* Status change */}
          {complaint.status !== 'CLOSED' && (
            <div className="border-t border-border pt-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Change Status</h4>
              <Input value={changedBy} onChange={e => setChangedBy(e.target.value)} placeholder="Changed by" className="h-8 text-xs" />
              <Textarea value={statusComment} onChange={e => setStatusComment(e.target.value)} placeholder="Comment…" className="text-xs min-h-[50px]" />
              <div className="flex gap-2">
                {complaint.status === 'OPEN' && (
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-warning border-warning/30" onClick={() => handleStatusUpdate('IN_REVIEW')} disabled={updating}>
                    {updating && <Loader2 size={12} className="animate-spin" />} Mark In Review
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs gap-1 text-success border-success/30" onClick={() => handleStatusUpdate('CLOSED')} disabled={updating}>
                  {updating && <Loader2 size={12} className="animate-spin" />} Close
                </Button>
              </div>
            </div>
          )}

          {/* History */}
          <div className="border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <History size={12} /> History
            </h4>
            {loadingHistory ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading…</div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history entries</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="text-xs flex gap-2">
                    <span className="text-muted-foreground whitespace-nowrap">{new Date(h.changed_at).toLocaleString()}</span>
                    <span className="font-medium">{h.action}</span>
                    {h.details && <span className="text-muted-foreground">— {h.details}</span>}
                    <span className="text-muted-foreground ml-auto">by {h.changed_by}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2">{label}</span>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', value === opt ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}>
          {opt === 'ALL' ? 'All' : opt}
        </button>
      ))}
    </div>
  );
}
