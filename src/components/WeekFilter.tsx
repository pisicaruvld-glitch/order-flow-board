import { useMemo, useState, useRef, useEffect } from 'react';
import { Order } from '@/lib/types';
import { getFactoryWeek, currentFactoryWeek, parseKwFilter, cn } from '@/lib/utils';
import { Calendar, Check, ChevronDown } from 'lucide-react';

interface KwFilterProps {
  orders: Order[];
  value: string; // "all" | "this" | "10,11"
  onChange: (v: string) => void;
  tv?: boolean;
}

export function WeekFilter({ orders, value, onChange, tv }: KwFilterProps) {
  const thisWeek = currentFactoryWeek();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const availableWeeks = useMemo(() => {
    const set = new Set<number>();
    orders.forEach(o => {
      const w = getFactoryWeek(o.Start_date_sched);
      if (w !== null) set.add(w);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [orders]);

  const selectedWeeks = parseKwFilter(value);
  const isAll = value === 'all';
  const selectedSet = new Set(selectedWeeks ?? []);

  const toggleWeek = (w: number) => {
    if (isAll) {
      // switching from all → single week
      onChange(String(w));
      return;
    }
    const next = new Set(selectedSet);
    if (next.has(w)) {
      next.delete(w);
    } else {
      next.add(w);
    }
    if (next.size === 0) {
      onChange('all');
    } else {
      onChange(Array.from(next).sort((a, b) => a - b).join(','));
    }
  };

  const selectThis = () => onChange('this');
  const selectAll = () => onChange('all');

  // Display label
  const displayLabel = isAll
    ? 'All KW'
    : value === 'this'
      ? `KW${thisWeek}`
      : selectedWeeks && selectedWeeks.length <= 3
        ? selectedWeeks.map(w => `KW${w}`).join(', ')
        : `${selectedWeeks?.length} KWs`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 border border-border rounded-md bg-card text-sm transition-colors hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-ring',
          tv ? 'px-4 py-2' : 'px-3 py-2'
        )}
      >
        <Calendar size={tv ? 16 : 14} className="text-muted-foreground" />
        <span className="font-medium text-foreground">{displayLabel}</span>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Selected KW chips (shown next to dropdown) */}
      {!isAll && tv && selectedWeeks && (
        <span className="absolute -right-2 translate-x-full top-1/2 -translate-y-1/2 text-2xl font-bold text-primary tabular-nums whitespace-nowrap ml-3">
          {selectedWeeks.map(w => `KW${w}`).join(' · ')}
        </span>
      )}

      {open && (
        <div className={cn(
          'absolute z-50 mt-1 border border-border rounded-md bg-popover text-popover-foreground shadow-md min-w-[180px] py-1 max-h-72 overflow-y-auto scrollbar-thin',
          tv ? 'left-0' : 'left-0'
        )}>
          {/* All KW */}
          <button
            onClick={() => { selectAll(); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
              isAll && 'font-semibold'
            )}
          >
            <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', isAll ? 'bg-primary border-primary' : 'border-border')}>
              {isAll && <Check size={12} className="text-primary-foreground" />}
            </span>
            All KW
          </button>

          {/* This KW */}
          <button
            onClick={() => { selectThis(); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
              value === 'this' && 'font-semibold'
            )}
          >
            <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', value === 'this' ? 'bg-primary border-primary' : 'border-border')}>
              {value === 'this' && <Check size={12} className="text-primary-foreground" />}
            </span>
            This KW (KW{thisWeek})
          </button>

          {availableWeeks.length > 0 && <div className="border-t border-border my-1" />}

          {availableWeeks.map(w => {
            const checked = selectedSet.has(w);
            return (
              <button
                key={w}
                onClick={() => toggleWeek(w)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', checked ? 'bg-primary border-primary' : 'border-border')}>
                  {checked && <Check size={12} className="text-primary-foreground" />}
                </span>
                KW{w}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Filter orders by KW selection. Returns all if null weeks. */
export function filterByWeek(orders: Order[], kwValue: string): Order[] {
  const weeks = parseKwFilter(kwValue);
  if (!weeks) return orders;
  const set = new Set(weeks);
  return orders.filter(o => {
    const w = getFactoryWeek(o.Start_date_sched);
    return w !== null && set.has(w);
  });
}

/** Small badge showing KWxx for an order. */
export function WeekBadge({ dateString, className }: { dateString: string; className?: string }) {
  const w = getFactoryWeek(dateString);
  if (w === null) return null;
  return (
    <span className={cn('text-[9px] font-semibold bg-muted text-muted-foreground px-1 py-0.5 rounded leading-none', className)}>
      KW{w}
    </span>
  );
}
