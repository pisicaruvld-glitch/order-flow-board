import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { getWarehouseIssuesSummary, WarehouseIssuesSummary, getWarehouseIssuesTimeline, WarehouseIssuesTimeline } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subMonths } from 'date-fns';

type ChartMode = 'total' | 'open' | 'closed';
type GroupBy = 'day' | 'week' | 'month' | 'year';
type StatusFilter = 'all' | 'open' | 'closed';

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(262 83% 58%)',
  'hsl(197 71% 52%)',
];

function DatePickerButton({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <Calendar size={12} />
          {label}: {format(date, 'yyyy-MM-dd')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ReportsPage() {
  // Summary state
  const [summary, setSummary] = useState<WarehouseIssuesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('total');

  // Timeline state
  const [timeline, setTimeline] = useState<WarehouseIssuesTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>(() => subMonths(new Date(), 3));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await getWarehouseIssuesSummary());
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const data = await getWarehouseIssuesTimeline({
        date_from: format(dateFrom, 'yyyy-MM-dd'),
        date_to: format(dateTo, 'yyyy-MM-dd'),
        group_by: groupBy,
        status: statusFilter,
      });
      setTimeline(data);
    } catch (e: unknown) {
      setTimelineError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setTimelineLoading(false);
    }
  }, [dateFrom, dateTo, groupBy, statusFilter]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const refreshAll = useCallback(() => { loadSummary(); loadTimeline(); }, [loadSummary, loadTimeline]);

  // Summary chart data
  const summaryChartData = summary?.by_category
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({ name: c.category_label, total: c.total_issues, open: c.open_issues, closed: c.closed_issues })) ?? [];

  const dataKey = chartMode === 'total' ? 'total' : chartMode === 'open' ? 'open' : 'closed';
  const barColor = chartMode === 'total' ? 'hsl(var(--primary))' : chartMode === 'open' ? 'hsl(var(--destructive))' : 'hsl(142 71% 45%)';

  // Timeline chart data: pivot series into rows keyed by bucket
  const { lineChartData, visibleSeries } = useMemo(() => {
    if (!timeline) return { lineChartData: [], visibleSeries: [] };
    const series = timeline.series
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter(s => !hiddenCategories.has(s.category_code));
    const map = new Map<string, Record<string, number | string>>();
    for (const bucket of timeline.buckets) {
      map.set(bucket, { bucket });
    }
    for (const s of series) {
      for (const p of s.points) {
        const row = map.get(p.bucket);
        if (row) row[s.category_code] = p.value;
      }
    }
    return { lineChartData: Array.from(map.values()), visibleSeries: series };
  }, [timeline, hiddenCategories]);

  const totalTimelineIssues = useMemo(() => {
    if (!timeline) return 0;
    return timeline.series.reduce((sum, s) => sum + s.points.reduce((ps, p) => ps + p.value, 0), 0);
  }, [timeline]);

  const toggleCategory = (code: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        subtitle="Operational reports and analytics"
        actions={
          <button onClick={refreshAll} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="space-y-6">
        {/* ── Warehouse Issues Summary (existing) ── */}
        {summaryLoading && <Skeleton className="h-[420px] w-full rounded-lg" />}
        {summaryError && <ErrorMessage message={summaryError} onRetry={loadSummary} />}

        {!summaryLoading && !summaryError && summary && (
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
                        chartMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const s: any = summary as any;
                const totalIssues = s.total_issues ?? s.totalIssues ?? s.total ?? 0;
                const openIssues = s.open_issues ?? s.openIssues ?? s.open ?? 0;
                const closedIssues = s.closed_issues ?? s.closedIssues ?? s.closed ?? (totalIssues - openIssues);
                return (
                  <div className="flex items-center gap-6">
                    <div className="bg-muted rounded-lg px-5 py-3">
                      <p className="text-2xl font-bold text-foreground">{totalIssues}</p>
                      <p className="text-xs text-muted-foreground">Total Issues</p>
                    </div>
                    <div className="bg-muted rounded-lg px-5 py-3">
                      <p className="text-2xl font-bold text-destructive">{openIssues}</p>
                      <p className="text-xs text-muted-foreground">Open Issues</p>
                    </div>
                    <div className="bg-muted rounded-lg px-5 py-3">
                      <p className="text-2xl font-bold" style={{ color: 'hsl(142 71% 45%)' }}>{closedIssues}</p>
                      <p className="text-xs text-muted-foreground">Closed Issues</p>
                    </div>
                  </div>
                );
              })()}
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey={dataKey} fill={barColor} radius={[4, 4, 0, 0]} name={`${chartMode.charAt(0).toUpperCase() + chartMode.slice(1)} Issues`} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
                    {summary.by_category.sort((a, b) => a.sort_order - b.sort_order).map(c => (
                      <TableRow key={c.category_code}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{c.category_code}</code>
                            <span className="text-sm">{c.category_label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{c.total_issues}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{c.open_issues}</TableCell>
                        <TableCell className="text-right font-medium" style={{ color: 'hsl(142 71% 45%)' }}>{c.closed_issues}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{summary.total_issues}</TableCell>
                      <TableCell className="text-right text-destructive">{summary.by_category.reduce((s, c) => s + c.open_issues, 0)}</TableCell>
                      <TableCell className="text-right" style={{ color: 'hsl(142 71% 45%)' }}>{summary.by_category.reduce((s, c) => s + c.closed_issues, 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Warehouse Issues Timeline ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <CardTitle className="text-base">Warehouse Issues Timeline</CardTitle>
              </div>
            </div>
            {/* Filters row */}
            <div className="flex items-center gap-3 flex-wrap pt-3">
              <DatePickerButton date={dateFrom} onChange={setDateFrom} label="From" />
              <DatePickerButton date={dateTo} onChange={setDateTo} label="To" />
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {timelineLoading && (
              <div className="space-y-3">
                <Skeleton className="h-[300px] w-full rounded-lg" />
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-32 rounded-lg" />
                  <Skeleton className="h-16 w-32 rounded-lg" />
                  <Skeleton className="h-16 w-32 rounded-lg" />
                </div>
              </div>
            )}
            {timelineError && <ErrorMessage message={timelineError} onRetry={loadTimeline} />}

            {!timelineLoading && !timelineError && timeline && (
              <>
                {/* Summary cards */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="bg-muted rounded-lg px-4 py-2.5">
                    <p className="text-xl font-bold text-foreground">{totalTimelineIssues}</p>
                    <p className="text-[11px] text-muted-foreground">Total in Range</p>
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2.5">
                    <p className="text-xl font-bold text-foreground">{timeline.series.length}</p>
                    <p className="text-[11px] text-muted-foreground">Categories</p>
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2.5">
                    <p className="text-xl font-bold text-foreground">{timeline.buckets.length}</p>
                    <p className="text-[11px] text-muted-foreground">Time Buckets</p>
                  </div>
                </div>

                {/* Category toggles */}
                {timeline.series.length > 0 && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Categories:</span>
                    {timeline.series.sort((a, b) => a.sort_order - b.sort_order).map((s, i) => (
                      <label key={s.category_code} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <Checkbox
                          checked={!hiddenCategories.has(s.category_code)}
                          onCheckedChange={() => toggleCategory(s.category_code)}
                          className="h-3.5 w-3.5"
                        />
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                        {s.category_label}
                      </label>
                    ))}
                  </div>
                )}

                {/* Line chart */}
                {lineChartData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                    No issues found in the selected date range.
                  </div>
                ) : (
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="bucket"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
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
                        {visibleSeries.map((s, i) => (
                          <Line
                            key={s.category_code}
                            type="monotone"
                            dataKey={s.category_code}
                            name={s.category_label}
                            stroke={CATEGORY_COLORS[timeline.series.findIndex(ts => ts.category_code === s.category_code) % CATEGORY_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Category breakdown table for timeline */}
                {timeline.series.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Total in Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timeline.series.sort((a, b) => a.sort_order - b.sort_order).map((s, i) => (
                          <TableRow key={s.category_code}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                                <span className="text-sm">{s.category_label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {s.points.reduce((sum, p) => sum + p.value, 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{totalTimelineIssues}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
