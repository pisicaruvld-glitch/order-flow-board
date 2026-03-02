import { useMemo } from 'react';
import { Order } from '@/lib/types';
import { getISOWeek, currentISOWeek, cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface WeekFilterProps {
  orders: Order[];
  value: string; // "all" | "this" | "10" etc.
  onChange: (v: string) => void;
  /** TV mode: larger text, simplified */
  tv?: boolean;
}

export function WeekFilter({ orders, value, onChange, tv }: WeekFilterProps) {
  const thisWeek = currentISOWeek();

  const availableWeeks = useMemo(() => {
    const set = new Set<number>();
    orders.forEach(o => {
      const w = getISOWeek(o.Start_date_sched);
      if (w !== null) set.add(w);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [orders]);

  const resolvedWeek = value === 'this' ? thisWeek : value === 'all' ? null : Number(value);
  const weekLabel = resolvedWeek != null ? `W${resolvedWeek}` : null;

  if (tv) {
    return (
      <div className="flex items-center gap-3">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-nav-bg text-nav-fg border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All weeks</option>
          <option value="this">This week (W{thisWeek})</option>
          {availableWeeks.map(w => (
            <option key={w} value={String(w)}>W{w}</option>
          ))}
        </select>
        {weekLabel && (
          <span className="text-2xl font-bold text-primary tabular-nums">{weekLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar size={14} className="text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="All weeks" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All weeks</SelectItem>
          <SelectItem value="this">This week (W{thisWeek})</SelectItem>
          {availableWeeks.map(w => (
            <SelectItem key={w} value={String(w)}>W{w}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {weekLabel && (
        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
          {weekLabel}
        </span>
      )}
    </div>
  );
}

/** Filter orders by week selection. Returns all if "all". */
export function filterByWeek(orders: Order[], weekValue: string): Order[] {
  if (weekValue === 'all') return orders;
  const thisWeek = currentISOWeek();
  const targetWeek = weekValue === 'this' ? thisWeek : Number(weekValue);
  if (isNaN(targetWeek)) return orders;
  return orders.filter(o => getISOWeek(o.Start_date_sched) === targetWeek);
}

/** Small badge showing Wxx for an order. */
export function WeekBadge({ dateString, className }: { dateString: string; className?: string }) {
  const w = getISOWeek(dateString);
  if (w === null) return null;
  return (
    <span className={cn('text-[9px] font-semibold bg-muted text-muted-foreground px-1 py-0.5 rounded leading-none', className)}>
      W{w}
    </span>
  );
}
