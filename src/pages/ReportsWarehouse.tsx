import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import {
  PageContainer,
  PageHeader,
  ErrorMessage,
} from '@/components/Layout';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  RefreshCw,
  Calendar as CalendarIcon,
  Download,
  Save,
  Target,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  GroupBy,
  KpiCategory,
  KpiDefinition,
  KpiSummary,
  canEditWarehouseKpi,
  exportKpiXlsx,
  getKpiCategories,
  getKpiSummary,
  getWarehouseKpis,
  saveKpiEntry,
  setKpiTarget,
} from '@/lib/warehouseReportsApi';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(262 83% 58%)',
  'hsl(197 71% 52%)',
];

// First KPI we render. When backend exposes more, we can map them here.
const KPI_REGISTRY = [
  { code: 'LL01_ERRORS', label: 'LL01 Errors' },
];

function DatePickerButton({
  date,
  onChange,
  label,
}: {
  date: Date;
  onChange: (d: Date) => void;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <CalendarIcon size={12} />
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

// ============================================================
// KPI Card – self-contained per KPI so we can scale later
// ============================================================
function KpiCard({
  kpiCode,
  kpiLabel,
  meta,
  canEdit,
  isAdmin,
  onChanged,
}: {
  kpiCode: string;
  kpiLabel: string;
  meta?: KpiDefinition;
  canEdit: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [categories, setCategories] = useState<KpiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [targetValue, setTargetValue] = useState<string>(
    meta?.target_value != null ? String(meta.target_value) : '',
  );
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => {
    if (meta?.target_value != null) setTargetValue(String(meta.target_value));
  }, [meta?.target_value]);

  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    setCategoriesError(null);
    getKpiCategories(kpiCode)
      .then((resp) => {
        if (cancelled) return;
        setCategories(resp.categories ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setCategoriesError(e instanceof Error ? e.message : 'Failed to load categories');
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kpiCode]);

  const totalEntered = useMemo(() => {
    return categories.reduce((sum, c) => {
      const n = Number(values[c.code]);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }, [values, categories]);

  const handleSaveEntries = async () => {
    if (categories.length === 0) return;
    const entries = categories.map((c) => {
      const raw = values[c.code];
      const num = raw === '' || raw == null ? 0 : Number(raw);
      return {
        category_code: c.code,
        value: Number.isFinite(num) ? num : 0,
        comment: (comments[c.code] ?? '').trim(),
      };
    });
    setSaving(true);
    try {
      await saveKpiEntry(kpiCode, {
        entry_date: format(entryDate, 'yyyy-MM-dd'),
        entries,
      });
      toast({ title: 'Saved', description: `${kpiLabel} entries saved` });
      setValues({});
      setComments({});
      onChanged();
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTarget = async () => {
    const num = Number(targetValue);
    if (!Number.isFinite(num)) {
      toast({ title: 'Invalid target', description: 'Enter a number', variant: 'destructive' });
      return;
    }
    setSavingTarget(true);
    try {
      await setKpiTarget(kpiCode, { target_value: num, target_direction: 'MAX' });
      toast({ title: 'Target updated' });
      onChanged();
    } catch (e: unknown) {
      toast({
        title: 'Target save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingTarget(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <CardTitle className="text-base">{kpiLabel}</CardTitle>
            <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{kpiCode}</code>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {meta?.current_value != null && (
              <span>
                Current: <span className="font-semibold text-foreground">{meta.current_value}</span>
              </span>
            )}
            {meta?.target_value != null && (
              <span>
                Target ({meta.target_direction ?? 'MAX'}):{' '}
                <span className="font-semibold text-foreground">{meta.target_value}</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date + total */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Entry date</label>
            <DatePickerButton date={entryDate} onChange={setEntryDate} label="Date" />
          </div>
          <div className="text-xs text-muted-foreground">
            Total for date:{' '}
            <span className="font-semibold text-foreground tabular-nums">{totalEntered}</span>
          </div>
        </div>

        {/* Categories grid */}
        {categoriesLoading && <Skeleton className="h-32 w-full rounded-md" />}
        {categoriesError && (
          <p className="text-xs text-destructive">{categoriesError}</p>
        )}
        {!categoriesLoading && !categoriesError && categories.length === 0 && (
          <p className="text-xs text-muted-foreground">No categories defined for this KPI.</p>
        )}
        {!categoriesLoading && categories.length > 0 && (
          <div className="border border-border rounded-md divide-y divide-border">
            {categories.map((c) => (
              <div
                key={c.code}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5"
              >
                <div className="md:col-span-5">
                  <div className="text-sm font-medium text-foreground">{c.label}</div>
                  <code className="text-[10px] font-mono text-muted-foreground">{c.code}</code>
                </div>
                <div className="md:col-span-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={values[c.code] ?? ''}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [c.code]: e.target.value }))
                    }
                    placeholder="0"
                    disabled={!canEdit}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="md:col-span-5">
                  <Input
                    value={comments[c.code] ?? ''}
                    onChange={(e) =>
                      setComments((p) => ({ ...p, [c.code]: e.target.value }))
                    }
                    placeholder="Comment (optional)"
                    disabled={!canEdit}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button
            onClick={handleSaveEntries}
            disabled={!canEdit || saving || categories.length === 0}
            size="sm"
            className="gap-1.5"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save all categories'}
          </Button>
        </div>

        {!canEdit && (
          <p className="text-[11px] text-muted-foreground">
            You need <code className="font-mono">Warehouse</code> area or admin role to record entries.
          </p>
        )}

        {/* Target editor (admin only) */}
        {isAdmin && (
          <div className="border-t border-border pt-3 flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground block">Target value (MAX)</label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="h-9 w-32"
                placeholder="0"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveTarget}
              disabled={savingTarget || targetValue === ''}
              className="gap-1.5"
            >
              <Target size={14} />
              {savingTarget ? 'Saving…' : 'Update target'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================
export default function ReportsWarehousePage() {
  const { user, isAdmin } = useAuth();
  const canEdit = canEditWarehouseKpi(user);

  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState<Date>(() => subMonths(new Date(), 3));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [groupBy, setGroupBy] = useState<GroupBy>('week');

  // Per-KPI summary cache (keyed by kpi code)
  const [summaries, setSummaries] = useState<Record<string, KpiSummary | null>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    setKpisError(null);
    try {
      const resp = await getWarehouseKpis();
      setKpis(resp.kpis ?? []);
    } catch (e: unknown) {
      setKpisError(e instanceof Error ? e.message : 'Failed to load KPIs');
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const loadSummaries = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const params = {
        date_from: format(dateFrom, 'yyyy-MM-dd'),
        date_to: format(dateTo, 'yyyy-MM-dd'),
        group_by: groupBy,
      };
      const results = await Promise.all(
        KPI_REGISTRY.map(async (k) => {
          try {
            const s = await getKpiSummary(k.code, params);
            return [k.code, s] as const;
          } catch (e) {
            console.error(`[ReportsWarehouse] summary ${k.code} failed`, e);
            return [k.code, null] as const;
          }
        }),
      );
      setSummaries(Object.fromEntries(results));
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [dateFrom, dateTo, groupBy]);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  const refreshAll = useCallback(() => {
    loadKpis();
    loadSummaries();
  }, [loadKpis, loadSummaries]);

  const handleExport = async (kpiCode: string) => {
    setExporting(true);
    try {
      await exportKpiXlsx(kpiCode, {
        date_from: format(dateFrom, 'yyyy-MM-dd'),
        date_to: format(dateTo, 'yyyy-MM-dd'),
      });
    } catch (e: unknown) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const ll01Summary = summaries['LL01_ERRORS'] ?? null;
  const ll01Meta = useMemo(
    () => kpis.find((k) => k.code === 'LL01_ERRORS'),
    [kpis],
  );

  // Aggregate pie across all loaded KPIs (scalable)
  const combinedPie = useMemo(() => {
    const slices: { label: string; value: number }[] = [];
    for (const k of KPI_REGISTRY) {
      const s = summaries[k.code];
      if (!s) continue;
      if (s.pie && s.pie.length > 0) {
        for (const slice of s.pie) {
          slices.push({ label: slice.label || k.label, value: slice.value });
        }
      } else if (typeof s.total === 'number') {
        slices.push({ label: k.label, value: s.total });
      }
    }
    return slices;
  }, [summaries]);

  return (
    <PageContainer>
      <PageHeader
        title="Reports · Warehouse"
        subtitle="Warehouse KPI tracking — record daily values and review trends"
        actions={
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="space-y-6">
        {/* KPI cards */}
        {kpisLoading && <Skeleton className="h-[220px] w-full rounded-lg" />}
        {kpisError && <ErrorMessage message={kpisError} onRetry={loadKpis} />}
        {!kpisLoading && !kpisError && (
          <div className="space-y-4">
            {KPI_REGISTRY.map((k) => (
              <KpiCard
                key={k.code}
                kpiCode={k.code}
                kpiLabel={k.label}
                meta={kpis.find((x) => x.code === k.code) ?? (k.code === 'LL01_ERRORS' ? ll01Meta : undefined)}
                canEdit={canEdit}
                isAdmin={isAdmin}
                onChanged={refreshAll}
              />
            ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <CardTitle className="text-base">Trend & Distribution</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => handleExport('LL01_ERRORS')}
                  disabled={exporting}
                >
                  <Download size={14} />
                  {exporting ? 'Exporting…' : 'Export Excel'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {summaryLoading && <Skeleton className="h-[320px] w-full rounded-lg" />}
            {summaryError && <ErrorMessage message={summaryError} onRetry={loadSummaries} />}

            {!summaryLoading && !summaryError && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Timeline chart */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    LL01 Errors over time
                  </h3>
                  {ll01Summary && ll01Summary.timeline.length > 0 ? (
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ll01Summary.timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="bucket"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            angle={-30}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="LL01 Errors"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          {ll01Summary.target_value != null && (
                            <ReferenceLine
                              y={ll01Summary.target_value}
                              stroke="hsl(var(--destructive))"
                              strokeDasharray="4 4"
                              label={{
                                value: `Target ${ll01Summary.target_value}`,
                                fill: 'hsl(var(--destructive))',
                                fontSize: 11,
                                position: 'insideTopRight',
                              }}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No data in selected range.
                    </div>
                  )}
                </div>

                {/* Pie chart */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">KPI Distribution</h3>
                  {combinedPie.length > 0 ? (
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={combinedPie}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={(entry) => `${entry.label}: ${entry.value}`}
                          >
                            {combinedPie.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No distribution data.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
