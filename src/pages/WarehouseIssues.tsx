import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Issue, IssueHistoryEntry } from '@/lib/types';
import { getWarehouseIssues, getIssueHistory, addIssueFeedback, patchIssue, getWarehouseIssueCategories, WarehouseIssueCategory } from '@/lib/api';
import { getUsersByArea, OperationalUser, UserArea } from '@/lib/usersApi';
import { PageContainer, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Search, AlertTriangle, AlertOctagon, RefreshCw, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { AppConfig } from '@/lib/types';

interface WarehouseIssuesPageProps {
  config: AppConfig;
}

type SeverityFilter = 'ALL' | 'ERROR' | 'WARNING';
type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED';

const SEVERITY_TYPES: Record<string, 'ERROR' | 'WARNING'> = {
  MISSING_MATERIAL: 'ERROR',
  QUANTITY_MISMATCH: 'WARNING',
  DAMAGED_GOODS: 'ERROR',
  WRONG_ITEM: 'ERROR',
  DOCUMENTATION_ERROR: 'WARNING',
  OTHER: 'WARNING',
};

function getSeverity(issueType: string): 'ERROR' | 'WARNING' {
  return SEVERITY_TYPES[issueType] ?? 'WARNING';
}

function formatDaysOpen(d?: number | null): string {
  if (d == null || isNaN(Number(d))) return '—';
  const n = Math.max(0, Math.floor(Number(d)));
  return n === 1 ? '1 day' : `${n} days`;
}

// Production week starts on Friday. Anchor: 30 April 2025 = week 18, 1 May 2025 = week 19.
// → Friday 2 May 2025 starts week 19. Use this anchor to compute week numbers.
function productionWeekFromDate(d: Date): number {
  // Anchor: Friday 2025-05-02 = start of week 19 (UTC)
  const anchor = Date.UTC(2025, 4, 2); // May 2, 2025
  const anchorWeek = 19;
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dayMs = 86400000;
  const diffDays = Math.floor((utc - anchor) / dayMs);
  // Week boundary: Friday. Shift so the week containing the anchor starts at offset 0.
  const weekOffset = Math.floor(diffDays / 7);
  const wk = ((anchorWeek + weekOffset - 1) % 52 + 52) % 52 + 1;
  return wk;
}

// Defensive field normalization to handle backend naming variations (snake_case, camelCase, PascalCase)
function normalizeIssueFields<T extends Record<string, any>>(issue: T): T & { days_open?: number; start_week_num?: number | null; start_work_week?: string | number | null } {
  let daysOpen: number | null | undefined =
    issue.days_open ?? issue.daysOpen ?? issue.age_days ?? issue.ageDays ?? issue.open_days ?? issue.openDays ?? undefined;

  // Fallback: calculate from created_at if not provided
  if (daysOpen === undefined || daysOpen === null) {
    const createdRaw = issue.created_at ?? issue.createdAt;
    if (createdRaw) {
      const created = new Date(createdRaw);
      if (!isNaN(created.getTime())) {
        const diffMs = Date.now() - created.getTime();
        daysOpen = Math.max(0, Math.floor(diffMs / 86400000));
      }
    } else {
      console.warn('Missing created_at for issue:', issue.id ?? issue);
    }
  }

  let startWorkWeek: string | number | null | undefined =
    issue.start_work_week ?? issue.startWeekLabel ?? issue.startWeek ?? issue.start_week ?? undefined;

  // Fallback: calculate from order start date
  if (startWorkWeek === undefined || startWorkWeek === null || startWorkWeek === '') {
    const startRaw = issue.start_date_sched ?? issue.Start_date_sched ?? issue.startDateSched ?? issue.startDate;
    if (startRaw) {
      const sd = new Date(startRaw);
      if (!isNaN(sd.getTime())) {
        startWorkWeek = productionWeekFromDate(sd);
      }
    }
  }

  return {
    ...issue,
    days_open: daysOpen as number | undefined,
    start_work_week: startWorkWeek,
  };
}

type IssueRow = Issue & {
  has_purchasing_feedback?: boolean;
  purchasing_feedback_status?: string;
  last_feedback_at?: string;
  last_feedback_by?: string;
  last_feedback_text?: string;
  issue_category?: string;
  issue_category_label?: string;
  days_open?: number;
  age_days?: number;
  start_week_num?: number | string;
  start_work_week?: string | number | null;
  is_critical?: boolean;
  criticality?: string;
  eta_date?: string | null;
  eta?: string | null;
  eta_status?: string;
  is_eta_overdue?: boolean;
  finish_good_no?: string;
  finish_good_description?: string;
  part_number?: string;
  pn?: string;
  assigned_department?: string;
  assigned_to_user_id?: number;
  assigned_to_username?: string;
  created_by?: string;
  created_at?: string;
};

function getEta(issue: IssueRow): string | null {
  return (issue.eta_date ?? issue.eta ?? null) as string | null;
}

function isEtaOverdue(issue: IssueRow): boolean {
  if (issue.is_eta_overdue) return true;
  if (issue.eta_status && String(issue.eta_status).toUpperCase() === 'OVERDUE') return true;
  const eta = getEta(issue);
  if (!eta) return false;
  const d = new Date(eta);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isEtaToday(issue: IssueRow): boolean {
  const eta = getEta(issue);
  if (!eta) return false;
  const d = new Date(eta);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export default function WarehouseIssuesPage({ config }: WarehouseIssuesPageProps) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<WarehouseIssueCategory[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Selected issue id for detail panel
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  // Inline assignment state: keyed by issue id
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());
  const [areaUsers, setAreaUsers] = useState<Record<string, OperationalUser[]>>({});
  const [loadingArea, setLoadingArea] = useState<string | null>(null);
  const areaUsersRef = React.useRef(areaUsers);
  areaUsersRef.current = areaUsers;

  const fetchUsersForArea = useCallback(async (area: string) => {
    if (areaUsersRef.current[area]) return;
    setLoadingArea(area);
    try {
      const users = await getUsersByArea(area as UserArea);
      setAreaUsers(prev => ({ ...prev, [area]: users.filter(u => !!u.is_active) }));
    } catch {
      toast({ title: 'Error', description: `Failed to load users for ${area}`, variant: 'destructive' });
      setAreaUsers(prev => ({ ...prev, [area]: [] }));
    } finally {
      setLoadingArea(null);
    }
  }, []);

  const handleSaveAssignment = useCallback(async (issueId: string, dept: string, userId: string) => {
    setAssigningIds(prev => new Set(prev).add(issueId));
    try {
      const payload: any = {
        assigned_department: dept || null,
        assigned_to_user_id: userId ? Number(userId) : null,
      };
      const updated = await patchIssue(issueId, payload);
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      toast({ title: 'Assignment saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save assignment', variant: 'destructive' });
    } finally {
      setAssigningIds(prev => { const n = new Set(prev); n.delete(issueId); return n; });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'ALL' ? statusFilter : undefined;
      const qParam = debouncedSearch || undefined;
      const [data, cats] = await Promise.all([
        getWarehouseIssues(statusParam, qParam),
        getWarehouseIssueCategories().catch(() => [] as WarehouseIssueCategory[]),
      ]);
      setIssues(data);
      setCategories(cats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load warehouse issues');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // Preload users for departments already assigned in loaded issues
  useEffect(() => {
    const depts = new Set(issues.map(i => (i as any).assigned_department).filter(Boolean) as string[]);
    depts.forEach(d => { if (!areaUsers[d]) fetchUsersForArea(d); });
  }, [issues]);

  const filtered = useMemo(() => {
    let result = [...issues];
    if (severityFilter !== 'ALL') result = result.filter(i => getSeverity(i.issue_type) === severityFilter);
    return result;
  }, [issues, severityFilter]);

  const totalIssues = issues.length;
  const openIssues = issues.filter(i => i.status === 'OPEN').length;
  const errorCount = issues.filter(i => getSeverity(i.issue_type) === 'ERROR').length;

  const handleEtaChange = async (issueId: string, eta: string | null) => {
    try {
      const updated = await patchIssue(issueId, { eta_date: eta } as any);
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated, eta_date: eta ?? undefined } : i));
      toast({ title: eta ? 'ETA updated' : 'ETA cleared' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update ETA', variant: 'destructive' });
    }
  };

  const handleInlineStatusChange = async (issueId: string, newStatus: 'OPEN' | 'CLOSED') => {
    try {
      const updated = await patchIssue(issueId, { status: newStatus });
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      toast({ title: 'Status updated', description: `Issue ${newStatus === 'CLOSED' ? 'closed' : 'reopened'}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleCategoryChange = async (issueId: string, newCategory: string) => {
    try {
      const updated = await patchIssue(issueId, { issue_category: newCategory });
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      const catLabel = categories.find(c => c.category_code === newCategory)?.category_label ?? newCategory;
      toast({ title: 'Category updated', description: `Category set to ${catLabel}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update category', variant: 'destructive' });
    }
  };

  const handleToggleCritical = async (issueId: string, next: boolean) => {
    try {
      const updated = await patchIssue(issueId, { is_critical: next });
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated, is_critical: next } : i));
      toast({ title: next ? 'Marked as critical' : 'Criticality removed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update criticality', variant: 'destructive' });
    }
  };

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Warehouse Issues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All issues reported in the Warehouse area</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Issues" value={totalIssues} icon={<AlertTriangle size={18} />} color="text-muted-foreground" />
        <KpiCard label="Open Issues" value={openIssues} icon={<AlertOctagon size={18} />} color="text-destructive" />
        <KpiCard label="Errors" value={errorCount} icon={<AlertOctagon size={18} />} color="text-warning" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Order / Part Number / Finish Good…"
            className="pl-8 h-9 w-72 text-sm"
          />
        </div>
        <FilterGroup label="Status" value={statusFilter} options={['ALL', 'OPEN', 'CLOSED'] as const} onChange={v => setStatusFilter(v as StatusFilter)} />
        <FilterGroup label="Severity" value={severityFilter} options={['ALL', 'ERROR', 'WARNING'] as const} onChange={v => setSeverityFilter(v as SeverityFilter)} />
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {totalIssues} issues</span>
      </div>

      {loading && <LoadingSpinner label="Loading issues…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-24">Issue ID</TableHead>
                <TableHead className="w-28">Order</TableHead>
                <TableHead className="w-28">Finish Good No</TableHead>
                <TableHead>Finish Good Desc.</TableHead>
                <TableHead className="w-28">Part Number</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24">Days Open</TableHead>
                <TableHead className="w-24">Start Week</TableHead>
                <TableHead className="w-32">ETA</TableHead>
                <TableHead className="w-20">Purchasing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(rawIssue => {
                const issue = normalizeIssueFields(rawIssue) as IssueRow;
                const severity = getSeverity(issue.issue_type);
                const isOpen = issue.status === 'OPEN';

                const daysOpenDisplay = formatDaysOpen(issue.days_open);

                const startWeekRaw = issue.start_work_week;
                const startWeekDisplay =
                  startWeekRaw != null && String(startWeekRaw) !== ''
                    ? (typeof startWeekRaw === 'number' ? `KW ${startWeekRaw}` : String(startWeekRaw))
                    : '—';

                const eta = getEta(issue);
                const overdue = isEtaOverdue(issue);
                const dueToday = !overdue && isEtaToday(issue);

                return (
                  <TableRow
                    key={issue.id}
                    onClick={() => setSelectedIssueId(issue.id)}
                    className={cn(
                      'transition-colors cursor-pointer',
                      issue.is_critical && 'bg-destructive/20 border-l-4 border-l-destructive hover:bg-destructive/25',
                      !issue.is_critical && overdue && 'bg-warning/15 border-l-4 border-l-warning',
                      !issue.is_critical && !overdue && severity === 'ERROR' && 'bg-destructive/5',
                      !issue.is_critical && !overdue && severity === 'WARNING' && 'bg-warning/5',
                      !isOpen && 'opacity-60',
                    )}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{issue.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/warehouse`); }}
                        className={cn('font-mono text-xs hover:underline', isOpen ? 'font-bold text-foreground' : 'text-muted-foreground')}
                      >
                        {issue.order_id}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{issue.finish_good_no || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={issue.finish_good_description}>{issue.finish_good_description || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{issue.part_number || issue.pn || '—'}</span>
                        {issue.is_critical && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-destructive" title={issue.criticality || 'Critical'}>
                            <AlertOctagon size={10} /> Critical
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.issue_category_label || issue.issue_category || '—'}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground line-clamp-1">{issue.comment}</p>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded',
                        issue.status === 'OPEN' ? 'text-destructive bg-destructive/10' : 'text-success bg-success/10',
                      )}>
                        {issue.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{daysOpenDisplay}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{startWeekDisplay}</TableCell>
                    <TableCell className="text-xs">
                      {eta ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn('font-mono', overdue ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                            {eta}
                          </span>
                          {overdue && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Overdue</Badge>}
                          {dueToday && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Due today</Badge>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {issue.has_purchasing_feedback ? (
                        <CheckCircle2
                          size={16}
                          className="text-primary fill-primary/20"
                          aria-label="Has purchasing feedback"
                        />
                      ) : (
                        <CheckCircle2
                          size={16}
                          className="text-muted-foreground/40"
                          aria-label="No purchasing feedback"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <IssueDetailPanel
        issue={issues.find(i => i.id === selectedIssueId) || null}
        open={!!selectedIssueId}
        onClose={() => setSelectedIssueId(null)}
        categories={categories}
        areaUsers={areaUsers}
        loadingArea={loadingArea}
        assigning={selectedIssueId ? assigningIds.has(selectedIssueId) : false}
        fetchUsersForArea={fetchUsersForArea}
        onSaveAssignment={handleSaveAssignment}
        onCategoryChange={handleCategoryChange}
        onStatusChange={handleInlineStatusChange}
        onToggleCritical={handleToggleCritical}
        onEtaChange={handleEtaChange}
      />
    </PageContainer>
  );
}

// ============================================================
// Issue Detail Panel (Sheet) — full details, editable assignment / ETA / criticality
// ============================================================
interface IssueDetailPanelProps {
  issue: IssueRow | null;
  open: boolean;
  onClose: () => void;
  categories: WarehouseIssueCategory[];
  areaUsers: Record<string, OperationalUser[]>;
  loadingArea: string | null;
  assigning: boolean;
  fetchUsersForArea: (area: string) => void;
  onSaveAssignment: (issueId: string, dept: string, userId: string) => void;
  onCategoryChange: (issueId: string, cat: string) => void;
  onStatusChange: (issueId: string, status: 'OPEN' | 'CLOSED') => void;
  onToggleCritical: (issueId: string, next: boolean) => void;
  onEtaChange: (issueId: string, eta: string | null) => void;
}

function IssueDetailPanel({
  issue, open, onClose, categories, areaUsers, loadingArea, assigning,
  fetchUsersForArea, onDepartmentChange, onResponsibleChange, onCategoryChange,
  onStatusChange, onToggleCritical, onEtaChange,
}: IssueDetailPanelProps) {
  const [etaDraft, setEtaDraft] = useState<string>('');

  useEffect(() => {
    if (issue) {
      const e = (issue.eta_date ?? issue.eta ?? '') as string;
      // Normalize to YYYY-MM-DD if a full timestamp was returned
      setEtaDraft(e ? e.slice(0, 10) : '');
    }
  }, [issue?.id, issue?.eta_date, issue?.eta]);

  useEffect(() => {
    if (issue?.assigned_department) fetchUsersForArea(issue.assigned_department);
  }, [issue?.assigned_department, fetchUsersForArea]);

  if (!issue) return null;

  const eta = getEta(issue);
  const overdue = isEtaOverdue(issue);
  const dueToday = !overdue && isEtaToday(issue);
  const startWeekRaw = issue.start_work_week;
  const startWeekDisplay =
    startWeekRaw != null && String(startWeekRaw) !== ''
      ? (typeof startWeekRaw === 'number' ? `KW ${startWeekRaw}` : String(startWeekRaw))
      : '—';

  const handleSaveEta = () => {
    onEtaChange(issue.id, etaDraft || null);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Issue {issue.id.slice(0, 8)}
            {issue.is_critical && (
              <Badge variant="destructive" className="text-[10px]"><AlertOctagon size={10} className="mr-1" />Critical</Badge>
            )}
            {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
            {dueToday && <Badge variant="secondary" className="text-[10px]">Due today</Badge>}
          </SheetTitle>
          <SheetDescription>Order {issue.order_id}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 text-sm">
          {/* Read-only details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <DetailField label="Order" value={issue.order_id} mono />
            <DetailField label="Part Number" value={issue.part_number || issue.pn} mono />
            <DetailField label="Finish Good No" value={issue.finish_good_no} mono />
            <DetailField label="Finish Good Desc." value={issue.finish_good_description} />
            <DetailField label="Created By" value={issue.created_by} />
            <DetailField
              label="Created At"
              value={issue.created_at ? new Date(issue.created_at).toLocaleString() : undefined}
            />
            <DetailField label="Days Open" value={formatDaysOpen(issue.days_open)} />
            <DetailField label="Start Week" value={startWeekDisplay} />
            <DetailField label="Purchasing Feedback" value={issue.has_purchasing_feedback ? 'Yes' : 'No'} />
            <DetailField label="Criticality" value={issue.criticality || (issue.is_critical ? 'CRITICAL' : 'NORMAL')} />
          </div>

          {/* Comment */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Comment</label>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{issue.comment || '—'}</p>
          </div>

          {/* Status & Category */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                value={issue.status}
                onChange={(e) => onStatusChange(issue.id, e.target.value as 'OPEN' | 'CLOSED')}
                className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</label>
              <select
                value={issue.issue_category || ''}
                onChange={(e) => onCategoryChange(issue.id, e.target.value)}
                className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="">— None —</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.category_code} value={c.category_code}>{c.category_label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignment */}
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              Assignment {assigning && <Loader2 size={12} className="animate-spin" />}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Department</label>
                <select
                  value={issue.assigned_department || ''}
                  onChange={(e) => onDepartmentChange(issue.id, e.target.value)}
                  className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
                >
                  <option value="">— None —</option>
                  {(['Orders', 'Warehouse', 'Production', 'Logistics'] as const).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Responsible</label>
                <select
                  value={issue.assigned_to_user_id?.toString() || ''}
                  disabled={!issue.assigned_department || loadingArea === issue.assigned_department}
                  onChange={(e) => onResponsibleChange(issue.id, e.target.value, issue.assigned_department || '')}
                  className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background disabled:opacity-50"
                >
                  <option value="">— None —</option>
                  {(areaUsers[issue.assigned_department || ''] || []).map((u) => (
                    <option key={u.id} value={u.id.toString()}>{u.username}</option>
                  ))}
                  {issue.assigned_to_user_id && !(areaUsers[issue.assigned_department || ''] || []).some(u => u.id === issue.assigned_to_user_id) && (
                    <option value={issue.assigned_to_user_id.toString()}>
                      {issue.assigned_to_username || `User #${issue.assigned_to_user_id}`}
                    </option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* ETA */}
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">ETA</h4>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">ETA Date</label>
                <Input
                  type="date"
                  value={etaDraft}
                  onChange={(e) => setEtaDraft(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <Button size="sm" onClick={handleSaveEta} disabled={(etaDraft || '') === (eta ? eta.slice(0, 10) : '')}>
                Save ETA
              </Button>
              {eta && (
                <Button size="sm" variant="ghost" onClick={() => { setEtaDraft(''); onEtaChange(issue.id, null); }}>
                  Clear
                </Button>
              )}
            </div>
            {overdue && <p className="text-xs text-destructive mt-1">ETA is overdue.</p>}
            {dueToday && <p className="text-xs text-muted-foreground mt-1">ETA is today.</p>}
          </div>

          {/* Criticality */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={!!issue.is_critical}
                onCheckedChange={(v) => onToggleCritical(issue.id, !!v)}
              />
              <span className="text-sm">Mark as critical</span>
            </label>
          </div>

          {/* History & Feedback */}
          <div className="pt-2 border-t border-border">
            <FeedbackPanel issueId={issue.id} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm text-foreground', mono && 'font-mono')}>{value != null && value !== '' ? value : '—'}</p>
    </div>
  );
}

// ============================================================
// Feedback Panel (loads history + submit form)
// ============================================================
function FeedbackPanel({ issueId }: { issueId: string }) {
  const [history, setHistory] = useState<IssueHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getIssueHistory(issueId);
      setHistory(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load issue history.', variant: 'destructive' });
    } finally {
      setLoadingHistory(false);
    }
  }, [issueId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await addIssueFeedback(issueId, { feedback: feedback.trim() });
      setFeedback('');
      await loadHistory();
      toast({ title: 'Feedback added', description: 'Your feedback has been recorded.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit feedback.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const feedbackEntries = history.filter(h => h.action === 'FEEDBACK');

  return (
    <div className="border-t border-border bg-muted/20 p-4 space-y-4">
      {/* History */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">History</h4>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No history entries yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {history.map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(entry.changed_at).toLocaleDateString()}{' '}
                  {new Date(entry.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {entry.action === 'FEEDBACK' && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                    Purchasing
                  </span>
                )}
                <span className={cn('font-medium', entry.action === 'FEEDBACK' ? 'text-foreground' : 'text-muted-foreground')}>
                  {entry.action !== 'FEEDBACK' && <span className="text-muted-foreground">[{entry.action}]</span>}{' '}
                  {entry.details}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0">— {entry.changed_by}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback form */}
      <div className="border-t border-border pt-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add Feedback</h4>
        <div className="flex gap-2">
          <div className="flex gap-2 flex-1">
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Write your feedback…"
              className="text-xs min-h-[60px] flex-1 resize-none"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !feedback.trim()}
              className="self-end gap-1"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <div className={cn('p-2 rounded-lg bg-muted', color)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', value === opt ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
        >
          {opt === 'ALL' ? 'All' : opt}
        </button>
      ))}
    </div>
  );
}
