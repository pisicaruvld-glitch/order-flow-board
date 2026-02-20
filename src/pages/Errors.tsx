import { useState, useCallback } from 'react';
import { FlowError, ErrorCategory, ERROR_CATEGORY_META, AREAS } from '@/lib/types';
import { getOrders, getStatusMappings, computeFlowErrors } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge } from '@/components/Badges';
import { RefreshCw, AlertTriangle, AlertOctagon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorsPageProps {
  config: AppConfig;
}

const CATEGORY_ICONS: Record<ErrorCategory, React.ReactNode> = {
  E1_DISCREPANCY: <AlertOctagon size={14} />,
  E2_REGRESS: <AlertTriangle size={14} />,
  E3_MISSING: <AlertTriangle size={14} />,
  E4_INVALID: <AlertTriangle size={14} />,
};

const CATEGORY_BG: Record<ErrorCategory, string> = {
  E1_DISCREPANCY: 'bg-destructive/8 border-destructive/20',
  E2_REGRESS: 'bg-warning/8 border-warning/20',
  E3_MISSING: 'bg-info/8 border-info/20',
  E4_INVALID: 'bg-muted border-border',
};

export default function ErrorsPage({ config }: ErrorsPageProps) {
  const [errors, setErrors] = useState<FlowError[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ErrorCategory | ''>('');
  const [searchQ, setSearchQ] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const recompute = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [orders, mappings] = await Promise.all([getOrders(), getStatusMappings()]);
      const result = await computeFlowErrors(orders, mappings);
      setErrors(result);
      setLoaded(true);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to compute errors');
    } finally {
      setLoading(false);
    }
  }, []);

  const categories = (Object.keys(ERROR_CATEGORY_META) as ErrorCategory[]);

  const filtered = errors.filter(e => {
    const matchCat = !categoryFilter || e.category === categoryFilter;
    const q = (searchQ ?? '').toLowerCase();
    const matchQ = !q
      || String(e?.Order ?? '').toLowerCase().includes(q)
      || String(e?.Material ?? '').toLowerCase().includes(q)
      || String(e?.Plant ?? '').toLowerCase().includes(q)
      || String(e?.description ?? '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const countsByCategory = Object.fromEntries(
    categories.map(cat => [cat, errors.filter(e => e.category === cat).length])
  ) as Record<ErrorCategory, number>;

  return (
    <PageContainer>
      <PageHeader
        title="Errors & Discrepancies"
        subtitle="Read-only. Recomputed from current order data and SAP status mappings."
        actions={
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={recompute}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loaded ? 'Refresh' : 'Compute Errors'}
            </button>
          </div>
        }
      />

      {/* Category KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {categories.map(cat => {
          const meta = ERROR_CATEGORY_META[cat];
          const count = countsByCategory[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              className={cn(
                'border rounded-lg p-3 text-left transition-colors hover:border-primary/60',
                categoryFilter === cat ? 'border-primary ring-1 ring-primary' : 'border-border',
                !loaded && 'opacity-50 pointer-events-none'
              )}
            >
              <div className={cn('flex items-center gap-1.5 text-xs font-medium mb-1.5', meta.color)}>
                {CATEGORY_ICONS[cat]}
                <span className="font-mono text-[10px] font-bold">{cat.replace('_', ' ')}</span>
              </div>
              <div className="text-2xl font-bold kpi-animate">{loaded ? count : '—'}</div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-2">
                {meta.description}
              </p>
            </button>
          );
        })}
      </div>

      {!loaded && !loading && !loadError && (
        <div className="text-center py-20 text-muted-foreground">
          <AlertTriangle size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Click "Compute Errors" to analyse current order data</p>
          <p className="text-xs mt-1">This is a read-only view — no changes are made to any data.</p>
        </div>
      )}

      {loading && <LoadingSpinner label="Computing errors from order data…" />}
      {loadError && <ErrorMessage message={loadError} onRetry={recompute} />}

      {loaded && !loading && !loadError && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search order, material, plant…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as ErrorCategory | '')}
              className="text-sm border border-border rounded-md px-2 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{ERROR_CATEGORY_META[cat].label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {errors.length} errors</span>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm font-medium">
                {errors.length === 0 ? '✓ No errors detected' : 'No errors match current filter'}
              </p>
            </div>
          )}

          {/* Error table */}
          {filtered.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium">Category</th>
                      <th className="text-left px-4 py-2.5 font-medium">Order</th>
                      <th className="text-left px-4 py-2.5 font-medium">Material</th>
                      <th className="text-left px-4 py-2.5 font-medium">Plant</th>
                      <th className="text-left px-4 py-2.5 font-medium">Current Area</th>
                      <th className="text-left px-4 py-2.5 font-medium">SAP Area</th>
                      <th className="text-left px-4 py-2.5 font-medium">System Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => {
                      const meta = ERROR_CATEGORY_META[e.category];
                      return (
                        <tr
                          key={i}
                          className={cn(
                            'border-b border-border hover:bg-muted/30 transition-colors',
                            CATEGORY_BG[e.category]
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className={cn('flex items-center gap-1.5 text-xs font-semibold', meta.color)}>
                              {CATEGORY_ICONS[e.category]}
                              <span className="font-mono">{e.category.replace('_', ' ')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{String(e?.Order ?? '')}</td>
                           <td className="px-4 py-3 font-mono text-xs">{String(e?.Material ?? '')}</td>
                           <td className="px-4 py-3 text-xs">{String(e?.Plant ?? '')}</td>
                          <td className="px-4 py-3">
                            {e.current_area ? <AreaBadge area={e.current_area} size="sm" /> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {e.sap_area ? <AreaBadge area={e.sap_area} size="sm" /> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {e.system_status || '—'}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{e.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
