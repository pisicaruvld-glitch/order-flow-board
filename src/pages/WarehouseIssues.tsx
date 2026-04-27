import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Issue, IssueHistoryEntry } from '@/lib/types';
import { getWarehouseIssues, getIssueHistory, addIssueFeedback, patchIssue, getWarehouseIssueCategories, WarehouseIssueCategory } from '@/lib/api';
import { getUsersByArea, OperationalUser, UserArea } from '@/lib/usersApi';
import { PageContainer, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Search, AlertTriangle, AlertOctagon, RefreshCw, MessageSquarePlus, ChevronDown, ChevronUp, Loader2, Send, CheckCircle2, Info } from 'lucide-react';
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

// Defensive field normalization to handle backend naming variations (snake_case, camelCase, PascalCase)
function normalizeIssueFields<T extends Record<string, any>>(issue: T): T & { days_open?: number; start_week_num?: number | null; start_work_week?: string | number | null } {
  const normalized = {
    ...issue,
    days_open:
      issue.days_open ??
      issue.daysOpen ??
      issue.Days_Open ??
      issue.age_days ??
      null,
    start_week_num:
      issue.start_week_num ??
      issue.startWeekNum ??
      issue.Start_Week_Num ??
      null,
    start_work_week:
      issue.start_work_week ??
      issue.start_week ??
      issue.startWeek ??
      issue.Start_Week ??
      null,
  };

  // Optional: warn if critical fields are missing
  if (normalized.days_open == null) {
    console.warn('Missing days_open for issue:', issue.id ?? issue);
  }

  return normalized;
}

export default function WarehouseIssuesPage({ config }: WarehouseIssuesPageProps) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<(Issue & { has_purchasing_feedback?: boolean; purchasing_feedback_status?: string; last_feedback_at?: string; last_feedback_by?: string; last_feedback_text?: string; issue_category?: string; issue_category_label?: string; days_open?: number; age_days?: number; start_week_num?: number | string; start_work_week?: string; is_critical?: boolean; criticality?: string })[]>([]);
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

  // Expanded row for feedback
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
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

  const handleDepartmentChange = useCallback(async (issueId: string, dept: string) => {
    // Update local state immediately for responsiveness
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, assigned_department: dept || undefined, assigned_to_user_id: undefined, assigned_to_username: undefined } as any : i));
    if (dept) {
      fetchUsersForArea(dept);
      // Save department (clear user)
      setAssigningIds(prev => new Set(prev).add(issueId));
      try {
        const updated = await patchIssue(issueId, { assigned_department: dept, assigned_to_user_id: null } as any);
        setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      } catch {
        toast({ title: 'Error', description: 'Failed to update department', variant: 'destructive' });
      } finally {
        setAssigningIds(prev => { const n = new Set(prev); n.delete(issueId); return n; });
      }
    }
  }, [fetchUsersForArea]);

  const handleResponsibleChange = useCallback(async (issueId: string, userId: string, dept: string) => {
    setAssigningIds(prev => new Set(prev).add(issueId));
    try {
      const payload: any = { assigned_department: dept, assigned_to_user_id: userId ? Number(userId) : null };
      const updated = await patchIssue(issueId, payload);
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      toast({ title: 'Assignment saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to assign user', variant: 'destructive' });
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

  const toggleExpand = (issueId: string) => {
    setExpandedIssueId(prev => prev === issueId ? null : issueId);
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
                <TableHead className="w-28">Department</TableHead>
                <TableHead className="w-28">Responsible</TableHead>
                <TableHead className="w-24">Purchasing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-12">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(rawIssue => {
                const issue = normalizeIssueFields(rawIssue);
                const severity = getSeverity(issue.issue_type);
                const isOpen = issue.status === 'OPEN';
                const isExpanded = expandedIssueId === issue.id;

                // Days Open display logic
                const daysOpenValue =
                  issue.days_open ??
                  (rawIssue as any).daysOpen ??
                  (rawIssue as any).Days_Open ??
                  (rawIssue as any).age_days ??
                  null;
                const daysOpenDisplay = formatDaysOpen(daysOpenValue);

                // Start Week display logic
                const startWeekRaw =
                  issue.start_work_week ??
                  (rawIssue as any).start_week ??
                  (rawIssue as any).startWeek ??
                  (rawIssue as any).Start_Week ??
                  (issue.start_week_num ?? (rawIssue as any).startWeekNum ?? null);
                const startWeekDisplay =
                  startWeekRaw != null && String(startWeekRaw) !== ''
                    ? (typeof startWeekRaw === 'number' ? `KW ${startWeekRaw}` : String(startWeekRaw))
                    : '—';
                return (
                  <React.Fragment key={issue.id}>
                    <TableRow
                      className={cn(
                        'transition-colors',
                        issue.is_critical && 'bg-destructive/15 border-l-4 border-l-destructive',
                        !issue.is_critical && severity === 'ERROR' && 'bg-destructive/5',
                        !issue.is_critical && severity === 'WARNING' && 'bg-warning/5',
                        !isOpen && 'opacity-60',
                        isExpanded && 'border-b-0',
                      )}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{issue.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/warehouse`)}
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
                          {issue.is_critical ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCritical(issue.id, false)}
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-destructive hover:opacity-80"
                              title={issue.criticality ? `${issue.criticality} (click to remove)` : 'Critical (click to remove)'}
                            >
                              <AlertOctagon size={10} /> Critical
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCritical(issue.id, true)}
                              className="inline-flex items-center gap-0.5 text-[9px] font-medium uppercase text-muted-foreground/70 hover:text-destructive"
                              title="Mark as critical"
                            >
                              <AlertOctagon size={10} /> Mark
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          value={issue.issue_category || ''}
                          onChange={e => handleCategoryChange(issue.id, e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]"
                        >
                          <option value="">— None —</option>
                          {categories.filter(c => c.is_active).map(c => (
                            <option key={c.category_code} value={c.category_code}>{c.category_label}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground line-clamp-1">{issue.comment}</p>
                      </TableCell>
                      <TableCell>
                        <select
                          value={issue.status}
                          onChange={e => handleInlineStatusChange(issue.id, e.target.value as 'OPEN' | 'CLOSED')}
                          className={cn(
                            'text-xs border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring',
                            issue.status === 'OPEN' ? 'border-destructive/30 text-destructive' : 'border-success/30 text-success',
                          )}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDaysOpen(issue.days_open ?? issue.age_days)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {issue.start_work_week
                          ? issue.start_work_week
                          : (issue.start_week_num != null && issue.start_week_num !== '')
                            ? `KW ${issue.start_week_num}`
                            : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          {assigningIds.has(issue.id) && <Loader2 size={10} className="animate-spin absolute -left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                          <select
                            value={(issue as any).assigned_department || ''}
                            onChange={e => handleDepartmentChange(issue.id, e.target.value)}
                            className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring min-w-[110px]"
                          >
                            <option value="">— None —</option>
                            {(['Orders', 'Warehouse', 'Production', 'Logistics'] as const).map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          value={(issue as any).assigned_to_user_id?.toString() || ''}
                          disabled={!(issue as any).assigned_department || (loadingArea === (issue as any).assigned_department)}
                          onChange={e => handleResponsibleChange(issue.id, e.target.value, (issue as any).assigned_department)}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">— None —</option>
                          {(issue as any).assigned_department && (areaUsers[(issue as any).assigned_department] || []).length === 0 && !loadingArea && (
                            <option value="" disabled>No users available for this department</option>
                          )}
                          {(areaUsers[(issue as any).assigned_department] || []).map((u: OperationalUser) => (
                            <option key={u.id} value={u.id.toString()}>{u.username}</option>
                          ))}
                          {/* Show current assignee even if not yet in loaded list */}
                          {(issue as any).assigned_to_user_id && !(areaUsers[(issue as any).assigned_department] || []).some((u: OperationalUser) => u.id === (issue as any).assigned_to_user_id) && (
                            <option value={(issue as any).assigned_to_user_id.toString()}>{(issue as any).assigned_to_username || `User #${(issue as any).assigned_to_user_id}`}</option>
                          )}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {issue.has_purchasing_feedback ? (
                            <CheckCircle2
                              size={16}
                              className="text-primary fill-primary/20"
                              aria-label="Has purchasing feedback"
                            >
                              <title>{issue.last_feedback_text ? `${issue.last_feedback_by}: ${issue.last_feedback_text}` : 'Has purchasing feedback'}</title>
                            </CheckCircle2>
                          ) : (
                            <CheckCircle2
                              size={16}
                              className="text-muted-foreground/40"
                              aria-label="No purchasing feedback"
                            />
                          )}
                          <Button
                            variant={isExpanded ? 'secondary' : 'ghost'}
                            size="sm"
                            className="text-xs gap-1 h-7"
                            onClick={() => toggleExpand(issue.id)}
                          >
                            <MessageSquarePlus size={14} />
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${issue.id}-feedback`} className={cn(severity === 'ERROR' && 'bg-destructive/5', severity === 'WARNING' && 'bg-warning/5')}>
                        <TableCell colSpan={13} className="p-0">
                          <FeedbackPanel issueId={issue.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
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
