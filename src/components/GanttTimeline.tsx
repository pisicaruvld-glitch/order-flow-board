import { useState, useEffect, useRef } from 'react';
import { OrderTimeline, OrderTimelineEntry } from '@/lib/types';
import { getOrderTimeline } from '@/lib/api';
import { LoadingSpinner } from './Layout';
import { GitCompareArrows, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GanttTimelineProps {
  orderId: string;
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
        <span className="text-foreground font-medium">{entry.Start_date_sched}</span>
        <span>Finish:</span>
        <span className="text-foreground font-medium">{entry.Scheduled_finish_date}</span>
        <span>Quantity:</span>
        <span className="text-foreground font-medium">{entry.Order_quantity.toLocaleString()}</span>
        <span>Status:</span>
        <span className="text-foreground font-mono font-medium">{entry.System_Status}</span>
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
  const total = maxDate.getTime() - minDate.getTime();
  const start = new Date(entry.Start_date_sched).getTime();
  const end = new Date(entry.Scheduled_finish_date).getTime();
  const leftPct = total > 0 ? ((start - minDate.getTime()) / total) * 100 : 0;
  const widthPct = total > 0 ? ((end - start) / total) * 100 : 10;

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
          style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` }}
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
// Main Component
// ============================================================
export function GanttTimeline({ orderId }: GanttTimelineProps) {
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
    <div className="border border-border rounded-lg p-4 mt-4 flex items-center gap-2 text-xs text-muted-foreground">
      <AlertCircle size={14} className="text-warning shrink-0" />
      Timeline unavailable: {error}
    </div>
  );

  if (!timeline || timeline.entries.length === 0) return (
    <div className="border border-border rounded-lg p-4 mt-4 text-xs text-muted-foreground text-center">
      No timeline data available for this order.
    </div>
  );

  // Compute global date range
  const allDates = timeline.entries.flatMap(e => [
    new Date(e.Start_date_sched),
    new Date(e.Scheduled_finish_date),
  ]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  // Pad by 5%
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

          {timeline.entries.map((entry, i) => (
            <GanttBar
              key={i}
              entry={entry}
              minDate={paddedMin}
              maxDate={paddedMax}
              isLatest={i === latestIdx}
              index={i}
            />
          ))}

          <p className="text-[10px] text-muted-foreground mt-2 pl-[156px]">
            Hover over bars to see version details · Latest version highlighted
          </p>
        </div>
      )}
    </div>
  );
}
