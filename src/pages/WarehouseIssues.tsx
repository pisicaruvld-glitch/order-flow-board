import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Issue, ISSUE_TYPES, AppConfig } from '@/lib/types';
import { getWarehouseIssues } from '@/lib/api';
import { PageContainer, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { IssueBadge } from '@/components/Badges';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Search, AlertTriangle, AlertOctagon, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function WarehouseIssuesPage({ config }: WarehouseIssuesPageProps) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseIssues();
      setIssues(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load warehouse issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = [...issues];
    if (statusFilter !== 'ALL') result = result.filter(i => i.status === statusFilter);
    if (severityFilter !== 'ALL') result = result.filter(i => getSeverity(i.issue_type) === severityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i => i.order_id.toLowerCase().includes(q));
    }
    return result;
  }, [issues, statusFilter, severityFilter, search]);

  // KPIs
  const totalIssues = issues.length;
  const openIssues = issues.filter(i => i.status === 'OPEN').length;
  const errorCount = issues.filter(i => getSeverity(i.issue_type) === 'ERROR').length;

  return (
    <PageContainer>
      {/* Header */}
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

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Issues" value={totalIssues} icon={<AlertTriangle size={18} />} color="text-muted-foreground" />
        <KpiCard label="Open Issues" value={openIssues} icon={<AlertOctagon size={18} />} color="text-destructive" />
        <KpiCard label="Errors" value={errorCount} icon={<AlertOctagon size={18} />} color="text-warning" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Order ID…"
            className="pl-8 h-9 w-56 text-sm"
          />
        </div>

        <FilterGroup
          label="Status"
          value={statusFilter}
          options={['ALL', 'OPEN', 'CLOSED'] as const}
          onChange={v => setStatusFilter(v as StatusFilter)}
        />

        <FilterGroup
          label="Severity"
          value={severityFilter}
          options={['ALL', 'ERROR', 'WARNING'] as const}
          onChange={v => setSeverityFilter(v as SeverityFilter)}
        />

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {totalIssues} issues
        </span>
      </div>

      {/* Table */}
      {loading && <LoadingSpinner label="Loading issues…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-32">Order</TableHead>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-36">Created At</TableHead>
                <TableHead className="w-28">Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(issue => {
                const severity = getSeverity(issue.issue_type);
                const isOpen = issue.status === 'OPEN';
                return (
                  <TableRow
                    key={issue.id}
                    className={cn(
                      'transition-colors',
                      severity === 'ERROR' && 'bg-destructive/5',
                      severity === 'WARNING' && 'bg-warning/5',
                      !isOpen && 'opacity-60',
                    )}
                  >
                    <TableCell>
                      <button
                        onClick={() => navigate(`/warehouse`)}
                        className={cn(
                          'font-mono text-xs hover:underline',
                          isOpen ? 'font-bold text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {issue.order_id}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          severity === 'ERROR' ? 'text-destructive' : 'text-warning',
                        )}
                      >
                        {severity === 'ERROR' ? <AlertOctagon size={12} /> : <AlertTriangle size={12} />}
                        {severity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <IssueBadge status={issue.status} />
                    </TableCell>
                    <TableCell>
                      <div className={cn(!isOpen && 'text-muted-foreground')}>
                        <span className="text-xs font-medium">
                          {ISSUE_TYPES.find(t => t.value === issue.issue_type)?.label ?? issue.issue_type}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{issue.comment}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(issue.created_at).toLocaleDateString()}{' '}
                      {new Date(issue.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.created_by}
                    </TableCell>
                  </TableRow>
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
// Sub-components
// ============================================================
function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
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

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground',
          )}
        >
          {opt === 'ALL' ? 'All' : opt}
        </button>
      ))}
    </div>
  );
}
