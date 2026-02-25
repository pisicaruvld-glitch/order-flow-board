import { Area } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AreaBadgeProps {
  area: Area | string | null | undefined;
  size?: 'sm' | 'md';
}

const areaConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Orders: {
    bg: 'bg-area-orders-bg',
    text: 'text-area-orders',
    dot: 'bg-area-orders',
  },
  Warehouse: {
    bg: 'bg-area-warehouse-bg',
    text: 'text-area-warehouse',
    dot: 'bg-area-warehouse',
  },
  Production: {
    bg: 'bg-area-production-bg',
    text: 'text-area-production',
    dot: 'bg-area-production',
  },
  Logistics: {
    bg: 'bg-area-logistics-bg',
    text: 'text-area-logistics',
    dot: 'bg-area-logistics',
  },
  HIDDEN: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    dot: 'bg-muted-foreground',
  },
};

const DEFAULT_AREA = 'Orders';

export function AreaBadge({ area, size = 'md' }: AreaBadgeProps) {
  const safeArea = typeof area === 'string' && areaConfig[area] ? area : DEFAULT_AREA;
  const c = areaConfig[safeArea] ?? areaConfig[DEFAULT_AREA];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium',
        c.bg, c.text,
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
      )}
    >
      <span className={cn('rounded-full', c.dot, size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5')} />
      {safeArea}
    </span>
  );
}

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-mono font-medium',
        'bg-secondary text-secondary-foreground',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
      )}
    >
      {status || '—'}
    </span>
  );
}

export function IssueBadge({ status }: { status: 'OPEN' | 'CLOSED' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded text-xs font-medium px-2 py-0.5',
        status === 'OPEN'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-success'
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'OPEN' ? 'bg-destructive' : 'bg-success'
        )}
      />
      {status}
    </span>
  );
}
