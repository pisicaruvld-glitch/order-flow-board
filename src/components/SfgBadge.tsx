import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

export function isSFG(order: Order): boolean {
  return order.product_type === 'SFG';
}

export function getSfgFinishedQty(order: Order): number {
  if (order.finished_qty != null) return order.finished_qty;
  return (order.prod_delivered_qty ?? 0) - (order.prod_scrap_qty ?? 0);
}

export function SfgBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-info/15 text-info border border-info/30',
      className
    )}>
      SEMIFINISHED
    </span>
  );
}

export function SfgProgress({ order, className }: { order: Order; className?: string }) {
  const finished = getSfgFinishedQty(order);
  const total = order.Order_quantity ?? 0;
  return (
    <span className={cn('text-[10px] text-muted-foreground', className)}>
      Finished: <strong className="text-foreground">{finished}</strong> / {total}
    </span>
  );
}
