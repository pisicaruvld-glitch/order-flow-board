import { Order, ProductionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function isSFG(order: Order): boolean {
  return order.product_type === 'SFG';
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

/** Show SFG quantities from production-status response */
export function SfgProductionQty({ prodStatus, orderQty, className }: { prodStatus?: ProductionStatus; orderQty: number; className?: string }) {
  const gross = prodStatus?.gross_finished_qty ?? 0;
  const scrap = prodStatus?.scrap_qty ?? 0;
  const good = prodStatus?.good_finished_qty ?? (gross - scrap);
  const remaining = prodStatus?.remaining_qty ?? Math.max(0, orderQty - good);

  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground', className)}>
      <span>Gross: <strong className="text-foreground">{gross}</strong></span>
      <span>Scrap: <strong className="text-foreground">{scrap}</strong></span>
      <span>Good: <strong className="text-foreground">{good}</strong></span>
      <span>Remaining: <strong className={cn('text-foreground', remaining === 0 && 'text-success')}>{remaining}</strong></span>
    </div>
  );
}

/** Legacy progress display for compact cards (Dashboard/TV) using order payload fields */
export function SfgProgress({ order, className }: { order: Order; className?: string }) {
  const finished = getSfgFinishedQty(order);
  const total = order.Order_quantity ?? 0;
  return (
    <span className={cn('text-[10px] text-muted-foreground', className)}>
      Finished: <strong className="text-foreground">{finished}</strong> / {total}
    </span>
  );
}

export function getSfgFinishedQty(order: Order): number {
  if (order.finished_qty != null) return order.finished_qty;
  return (order.prod_delivered_qty ?? 0) - (order.prod_scrap_qty ?? 0);
}
