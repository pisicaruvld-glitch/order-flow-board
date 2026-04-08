import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getAdminAiAnalysis,
  AiAnalysisResponse,
  KeyCount,
  WordCount,
  RepeatOrder,
  MonthCount,
} from '@/lib/aiAnalysisApi';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Brain,
  BarChart3,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// ── helpers ──

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function PatternList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 15).map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md border border-border"
          >
            {it.label}
            <span className="text-[10px] font-semibold text-primary">({it.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineChart({ title, data, color }: { title: string; data: MonthCount[]; color: string }) {
  if (!data.length) return null;
  const chartConfig: ChartConfig = {
    count: { label: title, color },
  };
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function TextSection({ title, items, icon: Icon, variant = 'default' }: {
  title: string;
  items: string[];
  icon: typeof Lightbulb;
  variant?: 'default' | 'warning' | 'action';
}) {
  if (!items.length) return null;
  const colors = {
    default: 'text-primary',
    warning: 'text-warning',
    action: 'text-success',
  };
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        <Icon size={14} className={colors[variant]} />
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── main ──

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function AiAnalysisModal({ open, onOpenChange }: Props) {
  const [data, setData] = useState<AiAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAiAnalysis();
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load AI analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(
    (o: boolean) => {
      onOpenChange(o);
      if (o && !data && !loading) fetch();
    },
    [onOpenChange, data, loading, fetch],
  );

  const la = data?.local_analysis;
  const ai = data?.ai_analysis;

  const keyCountToItems = (arr?: KeyCount[]) =>
    (arr ?? []).map(k => ({ label: k.key, count: k.count }));
  const wordCountToItems = (arr?: WordCount[]) =>
    (arr ?? []).map(w => ({ label: w.word, count: w.count }));
  const repeatOrderToItems = (arr?: RepeatOrder[]) =>
    (arr ?? []).map(r => ({ label: r.order_id, count: r.count }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain size={18} className="text-primary" />
            AI Analyse
            {data && (
              <span
                className={cn(
                  'ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                  data.used_openai
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-secondary text-secondary-foreground border-border',
                )}
              >
                {data.used_openai ? 'OpenAI' : 'Local Analysis'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* toolbar */}
        <div className="flex items-center justify-between mb-4">
          {data && (
            <span className="text-[11px] text-muted-foreground">
              Generated: {new Date(data.generated_at).toLocaleString()}
            </span>
          )}
          <button
            onClick={fetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded border border-border hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 mb-4">
            <XCircle size={14} />
            {error}
          </div>
        )}

        {/* loading */}
        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Running analysis…</span>
          </div>
        )}

        {/* results */}
        {la && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <BarChart3 size={14} className="text-primary" />
                Executive Summary
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <SummaryCard label="Total Records" value={la.summary.total_records} />
                <SummaryCard label="Warehouse Issues" value={la.summary.warehouse_issues} />
                <SummaryCard label="Receiving Issues" value={la.summary.receiving_issues} />
                <SummaryCard label="Complaints" value={la.summary.complaints} />
                <SummaryCard label="Open" value={la.summary.open_records} />
                <SummaryCard label="Unassigned" value={la.summary.unassigned_records} />
              </div>
            </div>

            {/* Insights / Warnings / Actions */}
            <TextSection title="Insights" items={la.insights} icon={Lightbulb} />
            <TextSection title="Warnings" items={la.warnings} icon={AlertTriangle} variant="warning" />
            <TextSection title="Recommended Actions" items={la.recommended_actions} icon={TrendingUp} variant="action" />

            {/* Patterns */}
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <TrendingUp size={14} className="text-primary" />
                Top Patterns
              </h3>
              <div className="space-y-4">
                <PatternList title="Warehouse Categories" items={keyCountToItems(la.patterns.warehouse_categories)} />
                <PatternList title="Receiving Issue Types" items={keyCountToItems(la.patterns.receiving_types)} />
                <PatternList title="Complaint Types" items={keyCountToItems(la.patterns.complaint_types)} />
                <PatternList title="Assigned Departments" items={keyCountToItems(la.patterns.assigned_departments)} />
                <PatternList title="Repeat Component PN" items={keyCountToItems(la.patterns.repeat_component_pn)} />
                <PatternList title="Repeat Suppliers" items={keyCountToItems(la.patterns.repeat_supplier)} />
                <PatternList title="Repeat Finish Goods" items={keyCountToItems(la.patterns.repeat_finish_good)} />
                <PatternList title="Repeat Orders" items={repeatOrderToItems(la.patterns.repeat_orders)} />
                <PatternList title="Warehouse Top Words" items={wordCountToItems(la.patterns.warehouse_top_words)} />
                <PatternList title="Receiving Top Words" items={wordCountToItems(la.patterns.receiving_top_words)} />
                <PatternList title="Complaint Top Words" items={wordCountToItems(la.patterns.complaint_top_words)} />
              </div>
            </div>

            {/* Timeline charts */}
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <BarChart3 size={14} className="text-primary" />
                Timeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TimelineChart title="Warehouse Issues" data={la.timeline.warehouse_issues} color="hsl(var(--primary))" />
                <TimelineChart title="Receiving Issues" data={la.timeline.receiving_issues} color="hsl(var(--warning))" />
                <TimelineChart title="Complaints" data={la.timeline.complaints} color="hsl(var(--destructive))" />
              </div>
            </div>

            {/* AI Analysis */}
            {data?.used_openai && ai ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                  <Brain size={14} className="text-primary" />
                  ChatGPT Analysis
                </h3>
                {typeof (ai as Record<string, unknown>).raw_text === 'string' ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {(ai as Record<string, unknown>).raw_text as string}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(['executive_summary', 'key_patterns', 'weak_points', 'risks', 'recommended_actions', 'quick_wins'] as const).map(field => {
                      const val = (ai as Record<string, unknown>)[field];
                      if (!val) return null;
                      return (
                        <div key={field}>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            {field.replace(/_/g, ' ')}
                          </h4>
                          {typeof val === 'string' ? (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{val}</p>
                          ) : Array.isArray(val) ? (
                            <ul className="space-y-1">
                              {(val as string[]).map((s, i) => (
                                <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{String(s)}</li>
                              ))}
                            </ul>
                          ) : (
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                OpenAI analysis not available. Showing local pattern analysis only.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
