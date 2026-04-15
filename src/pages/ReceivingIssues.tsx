import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer, PageHeader, LoadingSpinner } from '@/components/Layout';
import { useAuth } from '@/lib/AuthContext';
import {
  getReceivingIssues,
  getReceivingIssueTypes,
  getReceivingSuppliers,
  createReceivingIssue,
  reviewReceivingIssue,
  closeReceivingIssue,
  getReceivingIssueHistory,
  patchReceivingIssue,
  ReceivingIssue,
  ReceivingIssueType,
  ReceivingSupplier,
  ReceivingIssueHistoryEntry,
  ReceivingIssueStatus,
} from '@/lib/receivingApi';
import { getUsersByArea, OperationalUser, UserArea } from '@/lib/usersApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Loader2, Eye, CheckCircle2, ClipboardCheck, Mail, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

type StatusFilter = 'ALL' | 'NEW' | 'ONGOING' | 'REVIEWED' | 'CLOSED';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ONGOING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  REVIEWED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  CLOSED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy HH:mm'); } catch { return d; }
}

export default function ReceivingIssuesPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<ReceivingIssue[]>([]);
  const [issueTypes, setIssueTypes] = useState<ReceivingIssueType[]>([]);
  const [suppliers, setSuppliers] = useState<ReceivingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<ReceivingIssue | null>(null);
  const [closeOpen, setCloseOpen] = useState<ReceivingIssue | null>(null);
  const [updateStatusOpen, setUpdateStatusOpen] = useState<ReceivingIssue | null>(null);
  const [detailOpen, setDetailOpen] = useState<ReceivingIssue | null>(null);
  const [history, setHistory] = useState<ReceivingIssueHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadMasterData = useCallback(async () => {
    try {
      const [types, supps] = await Promise.all([
        getReceivingIssueTypes().catch(() => []),
        getReceivingSuppliers().catch(() => []),
      ]);
      setIssueTypes(types.filter(t => t.is_active).sort((a, b) => a.sort_order - b.sort_order));
      setSuppliers(supps.filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order));
    } catch { /* ignore */ }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (debouncedSearch) params.q = debouncedSearch;
      if (supplierFilter !== 'ALL') params.supplier_id = Number(supplierFilter);
      if (typeFilter !== 'ALL') params.problem_type_id = Number(typeFilter);
      const data = await getReceivingIssues(params);
      setIssues(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, supplierFilter, typeFilter]);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  const openDetail = async (issue: ReceivingIssue) => {
    setDetailOpen(issue);
    setHistoryLoading(true);
    try {
      const h = await getReceivingIssueHistory(issue.id);
      setHistory(Array.isArray(h) ? h : []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Receiving Issues"
        subtitle="Inbound delivery and goods receipt problems"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus size={14} /> New Issue
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search SAP component / PO / description / supplier / type"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="ONGOING">Ongoing</SelectItem>
            <SelectItem value="REVIEWED">Reviewed</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.supplier_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {issueTypes.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.type_label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner label="Loading receiving issues…" />
      ) : error ? (
        <div className="text-destructive text-sm py-8 text-center">⚠ {error}</div>
      ) : issues.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">No receiving issues found.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-16">ID</TableHead>
                <TableHead className="text-xs w-24">Status</TableHead>
                <TableHead className="text-xs">Problem Type</TableHead>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">SAP Component</TableHead>
                <TableHead className="text-xs">PO Number</TableHead>
                <TableHead className="text-xs max-w-[220px]">Description</TableHead>
                <TableHead className="text-xs">Department</TableHead>
                <TableHead className="text-xs">Responsible</TableHead>
                <TableHead className="text-xs">Created By</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs">Reviewed</TableHead>
                <TableHead className="text-xs">Closed</TableHead>
                <TableHead className="text-xs w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(issue => (
                <TableRow key={issue.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-mono">{issue.id}</TableCell>
                  <TableCell><StatusBadge status={issue.status} /></TableCell>
                  <TableCell className="text-xs">{issue.problem_type_label ?? '—'}</TableCell>
                  <TableCell className="text-xs">{issue.supplier_name ?? '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{issue.sap_component_number || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{issue.po_number || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={issue.problem_description}>{issue.problem_description}</TableCell>
                  <TableCell className="text-xs">{(issue as any).assigned_department ?? '—'}</TableCell>
                  <TableCell className="text-xs">{(issue as any).assigned_to_username ?? '—'}</TableCell>
                  <TableCell className="text-xs">{issue.created_by_username ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(issue.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(issue.reviewed_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(issue.closed_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View details" onClick={() => openDetail(issue)}>
                        <Eye size={13} />
                      </Button>
                      {issue.status !== 'CLOSED' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" title="Update Status" onClick={() => setUpdateStatusOpen(issue)}>
                          <RefreshCw size={13} />
                        </Button>
                      )}
                      {(issue.status === 'NEW' || issue.status === 'ONGOING') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Review" onClick={() => setReviewOpen(issue)}>
                          <ClipboardCheck size={13} />
                        </Button>
                      )}
                      {issue.status === 'REVIEWED' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Close" onClick={() => setCloseOpen(issue)}>
                          <CheckCircle2 size={13} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        issueTypes={issueTypes}
        suppliers={suppliers}
        onCreated={() => { setCreateOpen(false); loadIssues(); }}
      />

      {/* Review Dialog */}
      {reviewOpen && (
        <ReviewDialog
          issue={reviewOpen}
          onClose={() => setReviewOpen(null)}
          onDone={() => { setReviewOpen(null); loadIssues(); }}
        />
      )}

      {/* Close Dialog */}
      {closeOpen && (
        <CloseDialog
          issue={closeOpen}
          onClose={() => setCloseOpen(null)}
          onDone={() => { setCloseOpen(null); loadIssues(); }}
        />
      )}

      {/* Update Status Dialog */}
      {updateStatusOpen && (
        <UpdateStatusDialog
          issue={updateStatusOpen}
          onClose={() => setUpdateStatusOpen(null)}
          onDone={() => { setUpdateStatusOpen(null); loadIssues(); }}
        />
      )}

      {/* Detail Dialog */}
      {detailOpen && (
        <DetailDialog
          issue={detailOpen}
          history={history}
          historyLoading={historyLoading}
          onClose={() => { setDetailOpen(null); setHistory([]); }}
          onReview={() => { setDetailOpen(null); setReviewOpen(detailOpen); }}
          onCloseIssue={() => { setDetailOpen(null); setCloseOpen(detailOpen); }}
          onUpdateStatus={() => { setDetailOpen(null); setUpdateStatusOpen(detailOpen); }}
        />
      )}
    </PageContainer>
  );
}

// ── Create Dialog ──

function CreateIssueDialog({
  open, onClose, issueTypes, suppliers, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  issueTypes: ReceivingIssueType[];
  suppliers: ReceivingSupplier[];
  onCreated: () => void;
}) {
  const [typeId, setTypeId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [sapComp, setSapComp] = useState('');
  const [poNum, setPoNum] = useState('');
  const [desc, setDesc] = useState('');
  const [department, setDepartment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [areaUsers, setAreaUsers] = useState<OperationalUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTypeId(''); setSupplierId(''); setSapComp(''); setPoNum(''); setDesc(''); setDepartment(''); setAssigneeId(''); setAreaUsers([]); };

  useEffect(() => {
    if (!department) { setAreaUsers([]); setAssigneeId(''); return; }
    setLoadingUsers(true);
    setAssigneeId('');
    getUsersByArea(department as UserArea)
      .then(users => setAreaUsers(users.filter(u => !!u.is_active)))
      .catch(() => { setAreaUsers([]); })
      .finally(() => setLoadingUsers(false));
  }, [department]);

  const canSubmit = typeId && supplierId && desc.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createReceivingIssue({
        problem_type_id: Number(typeId),
        supplier_id: Number(supplierId),
        sap_component_number: sapComp || undefined,
        po_number: poNum || undefined,
        problem_description: desc.trim(),
        assigned_department: department || undefined,
        assigned_to_user_id: assigneeId ? Number(assigneeId) : undefined,
      });
      toast({ title: 'Issue created', description: 'Receiving issue has been created successfully.' });
      reset();
      onCreated();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to create issue', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Receiving Issue</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Problem Type *</label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {issueTypes.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.type_label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select supplier…" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.supplier_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">SAP Component Number</label>
            <Input value={sapComp} onChange={e => setSapComp(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">PO Number</label>
            <Input value={poNum} onChange={e => setPoNum(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Problem Description *</label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the problem…" rows={3} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assign to Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Optional…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Orders">Orders</SelectItem>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Logistics">Logistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assign to User</label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!department || loadingUsers}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={loadingUsers ? 'Loading…' : !department ? 'Select department first' : 'Select user…'} /></SelectTrigger>
                <SelectContent>
                  {areaUsers.length === 0 && !loadingUsers && department ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No users available for this department</div>
                  ) : (
                    areaUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
            Create Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Review Dialog ──

function ReviewDialog({ issue, onClose, onDone }: { issue: ReceivingIssue; onClose: () => void; onDone: () => void }) {
  const [resolution, setResolution] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      await reviewReceivingIssue(issue.id, {
        proposed_resolution: resolution.trim(),
        review_comment: comment.trim() || undefined,
      });
      toast({ title: 'Issue reviewed', description: `Issue #${issue.id} has been reviewed.` });
      onDone();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Review failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Review Issue #{issue.id}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
            <strong>Problem:</strong> {issue.problem_description}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Proposed Resolution *</label>
            <Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} className="text-sm" placeholder="How should this be resolved?" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Review Comment</label>
            <Input value={comment} onChange={e => setComment(e.target.value)} className="h-9 text-sm" placeholder="Optional comment" />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            onClick={() => {
              const subject = `Receiving Issue #${issue.id} - ${issue.problem_type_label ?? ''} - ${issue.supplier_name ?? ''}`;
              const body = [
                'Receiving Issue Review',
                '',
                `Issue ID: ${issue.id}`,
                `Status: ${issue.status}`,
                `Problem Type: ${issue.problem_type_label ?? '—'}`,
                `Supplier: ${issue.supplier_name ?? '—'}`,
                `SAP Component Number: ${issue.sap_component_number || '—'}`,
                `PO Number: ${issue.po_number || '—'}`,
                `Created By: ${issue.created_by_username ?? '—'}`,
                `Created At: ${fmtDate(issue.created_at)}`,
                `Reviewed By: ${issue.reviewed_by_username ?? '—'}`,
                `Reviewed At: ${fmtDate(issue.reviewed_at)}`,
                '',
                'Problem Description:',
                issue.problem_description || '—',
                '',
                'Proposed Resolution:',
                resolution || '—',
                '',
                'Review Comment:',
                comment || '—',
              ].join('\n');
              window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
            }}
            className="gap-1.5"
          >
            <Mail size={14} /> Compose E-mail
          </Button>
          <Button onClick={handleSubmit} disabled={!resolution.trim() || submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Close Dialog ──

function CloseDialog({ issue, onClose, onDone }: { issue: ReceivingIssue; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await closeReceivingIssue(issue.id, { close_comment: comment.trim() || undefined });
      toast({ title: 'Issue closed', description: `Issue #${issue.id} has been closed.` });
      onDone();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Close failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Close Issue #{issue.id}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
            <strong>Resolution:</strong> {issue.proposed_resolution ?? '—'}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Close Comment</label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="text-sm" placeholder="Optional closing note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
            Close Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Update Status Dialog ──

function UpdateStatusDialog({ issue, onClose, onDone }: { issue: ReceivingIssue; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<string>(issue.status);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusOptions: { value: ReceivingIssueStatus; label: string }[] = [
    { value: 'NEW', label: 'New' },
    { value: 'ONGOING', label: 'Ongoing' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  const handleSubmit = async () => {
    if (status === issue.status && !comment.trim()) return;
    setSubmitting(true);
    try {
      await patchReceivingIssue(issue.id, {
        status: status !== issue.status ? status : undefined,
        comment: comment.trim() || undefined,
      });
      toast({ title: 'Issue updated', description: `Issue #${issue.id} status updated to ${status}.` });
      onDone();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Update failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Issue #{issue.id}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
            <strong>Current Status:</strong> <StatusBadge status={issue.status} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">New Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Comment</label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="text-sm" placeholder="Add a comment…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || (status === issue.status && !comment.trim())}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Dialog ──

function DetailDialog({
  issue, history, historyLoading, onClose, onReview, onCloseIssue, onUpdateStatus,
}: {
  issue: ReceivingIssue;
  history: ReceivingIssueHistoryEntry[];
  historyLoading: boolean;
  onClose: () => void;
  onReview: () => void;
  onCloseIssue: () => void;
  onUpdateStatus: () => void;
}) {
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issue #{issue.id} Details</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><StatusBadge status={issue.status} /></Field>
            <Field label="Problem Type">{issue.problem_type_label ?? '—'}</Field>
            <Field label="Supplier">{issue.supplier_name ?? '—'}</Field>
            <Field label="SAP Component">{issue.sap_component_number || '—'}</Field>
            <Field label="PO Number">{issue.po_number || '—'}</Field>
            <Field label="Created By">{issue.created_by_username ?? '—'}</Field>
            <Field label="Department">{(issue as any).assigned_department ?? '—'}</Field>
            <Field label="Responsible">{(issue as any).assigned_to_username ?? '—'}</Field>
            <Field label="Created">{fmtDate(issue.created_at)}</Field>
            <Field label="Reviewed">{fmtDate(issue.reviewed_at)}</Field>
            <Field label="Closed">{fmtDate(issue.closed_at)}</Field>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Problem Description</label>
            <p className="mt-1 text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{issue.problem_description}</p>
          </div>
          {issue.proposed_resolution && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Proposed Resolution</label>
              <p className="mt-1 text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{issue.proposed_resolution}</p>
            </div>
          )}

          {/* History */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">History</label>
            {historyLoading ? (
              <div className="text-xs text-muted-foreground py-2">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No history entries.</div>
            ) : (
              <div className="mt-1 space-y-1.5">
                {history.map(h => (
                  <div key={h.id} className="text-xs bg-muted/30 rounded px-2 py-1.5 flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">{fmtDate(h.created_at)}</span>
                    <span className="font-medium">{h.action}</span>
                    {h.comment && <span className="text-muted-foreground">— {h.comment}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {issue.status !== 'CLOSED' && (
            <Button size="sm" variant="outline" onClick={onUpdateStatus}>Update Status</Button>
          )}
          {(issue.status === 'NEW' || issue.status === 'ONGOING') && (
            <Button size="sm" variant="outline" onClick={onReview}>Review</Button>
          )}
          {issue.status === 'REVIEWED' && (
            <Button size="sm" variant="outline" onClick={onCloseIssue}>Close Issue</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
