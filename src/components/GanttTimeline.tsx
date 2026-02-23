import { useState, useEffect } from 'react';
import { OrderTimeline, OrderTimelineEntry, Order } from '@/lib/types';
import { getOrderTimeline } from '@/lib/api';
import { LoadingSpinner } from './Layout';
import { GitCompareArrows, AlertCircle, ChevronDown, ChevronUp, CalendarX, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Safe date parsing — accepts "YYYY-MM-DD" or ISO strings
// Returns null if invalid/empty
// ============================================================
function safeDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value.trim());
  return isNaN(d.getTime()) ? null : d;
}

// Pick start/end from entry using fallback chain
function resolveEntryDates(entry: OrderTimelineEntry): { start: Date | null; end: Date | null } {
  const e = entry as unknown as Record<string, unknown>;
  const start =
    safeDate(entry.Start_date_sched) ??
    safeDate(e.Basic_start_date as string | undefined) ??
    null;
  const end =
    safeDate(entry.Scheduled_finish_date) ??
    safeDate(e.Basic_finish_date as string | undefined) ??
    null;
  return { start, end };
}

// Pick start/end from an Order using fallback chain
export function resolveOrderDates(order: Order): { start: Date | null; end: Date | null } {
  const o = order as unknown as Record<string, unknown>;
  const start =
    safeDate(order.Start_date_sched) ??
    safeDate(o.Basic_start_date as string | undefined) ??
    null;
  const end =
    safeDate(order.Scheduled_finish_date) ??
    safeDate(o.Basic_finish_date as string | undefined) ??
    null;
  return { start, end };
}

// ============================================================
// Diff detection between consecutive snapshots
// ============================================================
const TRACKED_FIELDS = ['Start_date_sched', 'Scheduled_finish_date', 'Order_quantity'] as const;

interface FieldDiff {
  field: string;
  before: string;
  after: string;
}

function computeDiffs(older: OrderTimelineEntry, newer: OrderTimelineEntry): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of TRACKED_FIELDS) {
    const bVal = String((older as unknown as Record<string, unknown>)[f] ?? '');
    const aVal = String((newer as unknown as Record<string, unknown>)[f] ?? '');
    if (bVal !== aVal) {
      diffs.push({ field: f, before: bVal, after: aVal });
    }
  }
  return diffs;
}

function ChangeEventLine({ diffs, newerLabel }: { diffs: FieldDiff[]; newerLabel: string }) {
  if (diffs.length === 0) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-36 shrink-0" />
      <div className="flex-1 border-l-2 border-warning/60 pl-3 py-1 bg-warning/5 rounded-r-md">
        <p className="text-[10px] font-semibold text-warning mb-1 flex items-center gap-1">
          <GitCompareArrows size={10} />
          Change detected — {newerLabel}
        </p>
        <div className="space-y-0.5">
          {diffs.map(d => (
            <div key={d.field} className="flex items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">{d.field.replace(/_/g, ' ')}:</span>
              <span className="text-destructive line-through">{d.before || '—'}</span>
              <ArrowRight size={8} className="text-muted-foreground shrink-0" />
              <span className="text-success font-medium">{d.after || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tooltip
// ============================================================
function Tooltip({ entry }: { entry: OrderTimelineEntry }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-popover border border-border rounded-md shadow-lg p-2.5 text-xs pointer-events-none">
      <p className="font-semibold text-foreground mb-1.5">{entry.version_label ?? entry.upload_id ?? 'Version'}</p>
      {entry.uploaded_at && (
        <p className="text-muted-foreground mb-1">
          Uploaded: {new Date(entry.uploaded_at).toLocaleDateString()}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
        <span>Start:</span>
        <span className="text-foreground font-medium">{entry.Start_date_sched || '—'}</span>
        <span>Finish:</span>
        <span className="text-foreground font-medium">{entry.Scheduled_finish_date || '—'}</span>
        <span>Quantity:</span>
        <span className="text-foreground font-medium">{Number(entry.Order_quantity ?? 0).toLocaleString()}</span>
        <span>Status:</span>
        <span className="text-foreground font-mono font-medium">{entry.System_Status || '—'}</span>
      </div>
    </div>
  );
}

// ============================================================
// Gantt Bar Row
// ============================================================
function GanttBar({
  entry,
  minDate,
  maxDate,
  isLatest,
  index,
}: {
  entry: OrderTimelineEntry;
  minDate: Date;
  maxDate: Date;
  isLatest: boolean;
  index: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { start, end } = resolveEntryDates(entry);
  const total = maxDate.getTime() - minDate.getTime();

  // If dates are invalid, render a placeholder bar
  if (!start || !end) {
    return (
      <div className="flex items-center gap-3 h-8 group">
        <div className="w-36 shrink-0 text-right">
          <span className={cn('text-[10px] truncate block', isLatest ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            {entry.version_label ?? `Upload ${index + 1}`}
          </span>
        </div>
        <div className="flex-1 flex items-center">
          <span className="text-[10px] text-muted-foreground italic">No dates available</span>
        </div>
      </div>
    );
  }

  // If end < start — invalid schedule
  if (end.getTime() < start.getTime()) {
    return (
      <div className="flex items-center gap-3 h-8 group">
        <div className="w-36 shrink-0 text-right">
          <span className={cn('text-[10px] truncate block', isLatest ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            {entry.version_label ?? `Upload ${index + 1}`}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-1">
          <AlertCircle size={11} className="text-destructive shrink-0" />
          <span className="text-[10px] text-destructive">
            Invalid dates: {entry.Start_date_sched} → {entry.Scheduled_finish_date}
          </span>
        </div>
      </div>
    );
  }

  const leftPct = total > 0 ? ((start.getTime() - minDate.getTime()) / total) * 100 : 0;
  const widthPct = total > 0 ? ((end.getTime() - start.getTime()) / total) * 100 : 10;
  const versionLabel = entry.version_label ?? `Upload ${index + 1}`;

  return (
    <div className="flex items-center gap-3 h-8 group">
      {/* Label */}
      <div className="w-36 shrink-0 text-right">
        <span className={cn('text-[10px] truncate block', isLatest ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
          {versionLabel}
        </span>
      </div>
      {/* Bar track */}
      <div className="flex-1 relative h-5 bg-muted/40 rounded">
        <div
          className={cn(
            'absolute top-0 h-full rounded cursor-pointer transition-opacity',
            isLatest
              ? 'bg-primary opacity-90 hover:opacity-100'
              : 'bg-primary/30 hover:bg-primary/50'
          )}
          style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.max(widthPct, 1)}%` }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && <Tooltip entry={entry} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Inline Order Date Display (when no timeline history)
// ============================================================
function SingleOrderBar({ order }: { order: Order }) {
  const { start, end } = resolveOrderDates(order);

  if (!start && !end) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Calendar size={13} className="shrink-0" />
        No schedule dates available for this order.
      </div>
    );
  }

  if (start && end && end.getTime() < start.getTime()) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-destructive">
        <AlertCircle size={13} className="shrink-0" />
        Invalid schedule dates — Start: <code>{order.Start_date_sched}</code>, Finish: <code>{order.Scheduled_finish_date}</code>
      </div>
    );
  }

  return (
    <div className="py-3 space-y-1.5 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar size={13} className="shrink-0 text-primary" />
        <span>Current schedule</span>
      </div>
      <div className="flex items-center gap-4 pl-5">
        {start && (
          <span>
            <span className="text-muted-foreground">Start: </span>
            <strong className="text-foreground">{order.Start_date_sched}</strong>
          </span>
        )}
        {end && (
          <span>
            <span className="text-muted-foreground">Finish: </span>
            <strong className="text-foreground">{order.Scheduled_finish_date}</strong>
          </span>
        )}
      </div>
      {/* Mini visual bar */}
      <div className="pl-5 pr-2 pt-1">
        <div className="w-full h-4 bg-muted/40 rounded relative overflow-hidden">
          <div className="absolute inset-0 rounded bg-primary/60" style={{ left: '5%', right: '5%' }} />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>{start?.toLocaleDateString()}</span>
          <span>{end?.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Props
// ============================================================
interface GanttTimelineProps {
  orderId: string;
  order?: Order; // optional — used for fallback single-order display
}

// ============================================================
// Main Component
// ============================================================
export function GanttTimeline({ orderId, order }: GanttTimelineProps) {
  const [timeline, setTimeline] = useState<OrderTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setTimeline(null);
    getOrderTimeline(orderId)
      .then(data => setTimeline(data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load timeline'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <LoadingSpinner label="Loading timeline…" />
    </div>
  );

  if (error) return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <div className="flex items-center gap-2 text-xs text-warning mb-3">
        <AlertCircle size={14} className="shrink-0" />
        Timeline history unavailable: {error}
      </div>
      {/* Fallback: show order dates directly */}
      {order && <SingleOrderBar order={order} />}
    </div>
  );

  // No timeline history — show order dates as fallback
  if (!timeline || timeline.entries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 mt-4">
        <p className="text-xs text-muted-foreground mb-1 font-medium">No upload history for this order.</p>
        {order
          ? <SingleOrderBar order={order} />
          : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarX size={13} />
              No schedule dates available for this order.
            </p>
          )
        }
      </div>
    );
  }

  // Filter entries that have at least one valid date
  const validEntries = timeline.entries.filter(e => {
    const { start, end } = resolveEntryDates(e);
    return start !== null || end !== null;
  });

  if (validEntries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 mt-4">
        <p className="text-xs text-muted-foreground mb-1 font-medium">Timeline data loaded but no valid dates found.</p>
        {order ? <SingleOrderBar order={order} /> : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarX size={13} />
            No schedule dates available for this order.
          </p>
        )}
      </div>
    );
  }

  // Compute global date range from valid entries only
  const allDates: Date[] = [];
  for (const e of validEntries) {
    const { start, end } = resolveEntryDates(e);
    if (start) allDates.push(start);
    if (end) allDates.push(end);
  }

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const rangeMs = maxDate.getTime() - minDate.getTime();
  const padMs = rangeMs * 0.05 || 86400000;
  const paddedMin = new Date(minDate.getTime() - padMs);
  const paddedMax = new Date(maxDate.getTime() + padMs);

  const latestIdx = timeline.entries.length - 1;

  return (
    <div className="border border-border rounded-lg mt-4 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border hover:bg-muted/60 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <GitCompareArrows size={14} className="text-primary" />
          Timeline — {timeline.entries.length} version{timeline.entries.length > 1 ? 's' : ''}
        </div>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {!collapsed && (
        <div className="p-4 space-y-1">
          {/* Date axis labels */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-36 shrink-0" />
            <div className="flex-1 flex justify-between text-[9px] text-muted-foreground">
              <span>{paddedMin.toLocaleDateString()}</span>
              <span>{paddedMax.toLocaleDateString()}</span>
            </div>
          </div>

          {timeline.entries.map((entry, i) => {
            // Compute diffs between this entry and the previous one
            const diffs = i > 0 ? computeDiffs(timeline.entries[i - 1], entry) : [];
            const entryLabel = entry.version_label ?? `Upload ${i + 1}`;
            return (
              <div key={i}>
                {diffs.length > 0 && (
                  <ChangeEventLine diffs={diffs} newerLabel={entryLabel} />
                )}
                <GanttBar
                  entry={entry}
                  minDate={paddedMin}
                  maxDate={paddedMax}
                  isLatest={i === latestIdx}
                  index={i}
                />
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground mt-2 pl-[156px]">
            Hover over bars to see version details · Latest version highlighted
          </p>
        </div>
      )}
    </div>
  );
}
