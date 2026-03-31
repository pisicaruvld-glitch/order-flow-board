import { useState, useEffect, useCallback } from 'react';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { getWarehouseIssuesSummary, WarehouseIssuesSummary } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChartMode = 'total' | 'open' | 'closed';

export default function ReportsPage() {
  const [summary, setSummary] = useState<WarehouseIssuesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('total');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseIssuesSummary();
      setSummary(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chartData = summary?.by_category
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      name: c.category_label,
      total: c.total_issues,
      open: c.open_issues,
      closed: c.closed_issues,
    })) ?? [];

  const dataKey = chartMode === 'total' ? 'total' : chartMode === 'open' ? 'open' : 'closed';
  const barColor = chartMode === 'total' ? 'hsl(var(--primary))' : chartMode === 'open' ? 'hsl(var(--destructive))' : 'hsl(var(--success))';

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        subtitle="Operational reports and analytics"
        actions={
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      {loading && <LoadingSpinner label="Loading report data…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && summary && (
        <div className="space-y-6">
          {/* Warehouse Issues Report */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-primary" />
                  <CardTitle className="text-base">Warehouse Issues Report</CardTitle>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2">View</span>
                  {(['total', 'open', 'closed'] as ChartMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize',
                        chartMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* KPI */}
              <div className="flex items-center gap-6">
                <div className="bg-muted rounded-lg px-5 py-3">
                  <p className="text-2xl font-bold text-foreground">{summary.total_issues}</p>
                  <p className="text-xs text-muted-foreground">Total Issues</p>
                </div>
                <div className="bg-muted rounded-lg px-5 py-3">
                  <p className="text-2xl font-bold text-destructive">
                    {summary.by_category.reduce((s, c) => s + c.open_issues, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Open Issues</p>
                </div>
                <div className="bg-muted rounded-lg px-5 py-3">
                  <p className="text-2xl font-bold text-success">
                    {summary.by_category.reduce((s, c) => s + c.closed_issues, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Closed Issues</p>
                </div>
              </div>

              {/* Chart */}
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey={dataKey} fill={barColor} radius={[4, 4, 0, 0]} name={`${chartMode.charAt(0).toUpperCase() + chartMode.slice(1)} Issues`} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Closed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.by_category
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(c => (
                        <TableRow key={c.category_code}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{c.category_code}</code>
                              <span className="text-sm">{c.category_label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{c.total_issues}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">{c.open_issues}</TableCell>
                          <TableCell className="text-right font-medium text-success">{c.closed_issues}</TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{summary.total_issues}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {summary.by_category.reduce((s, c) => s + c.open_issues, 0)}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {summary.by_category.reduce((s, c) => s + c.closed_issues, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
