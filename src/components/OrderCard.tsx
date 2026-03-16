import { Order, Area } from '@/lib/types';
import { AreaBadge, StatusBadge } from './Badges';
import { ComplaintBadge } from './ComplaintBadge';
import { cn } from '@/lib/utils';
import { Slash, Circle, X, GitCompareArrows, Warehouse, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { isSFG, SfgBadge, SfgProgress } from './SfgBadge';
import { format } from 'date-fns';

// ============================================================
// Priority Icon
// ============================================================
export function PriorityIcon({ priority }: { priority?: string }) {
  if (!priority) return null;
  const p = priority.trim().toLowerCase();
  if (p === '/') return <span title="Priority: /"><Slash size={11} className="text-warning shrink-0" /></span>;
  if (p === 'o') return <span title="Priority: o"><Circle size={11} className="text-primary shrink-0" /></span>;
  if (p === 'x') return <span title="Priority: x"><X size={11} className="text-destructive shrink-0" /></span>;
  return null;
}

// ============================================================
// Changed Badge
// ============================================================
export function ChangedBadge({ fields }: { fields?: string[] }) {
  const label = fields && fields.length > 0
    ? fields.map(f => f.replace(/_/g, ' ')).join(', ')
    : 'Changed';
  return (
    <span
      title={`Changed: ${label}`}
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 leading-none shrink-0"
    >
      <GitCompareArrows size={8} />
      CHG
    </span>
  );
}

// ============================================================
// Liquid Fill helpers
// ============================================================
function getFillProgress(order: Order): number {
  const orderQty = Number(order?.Order_quantity ?? 0);
  if (orderQty <= 0) return 0;
  const yieldQty = Number(order?.Confirmed_Yield_Quantity ?? 0);
  if (yieldQty <= 0) return 0;
  return Math.min(yieldQty / orderQty, 1); // clamp 0–1
}

function getFillColor(progress: number): string {
  if (progress <= 0) return 'transparent';
  if (progress < 0.30) return '#dc2626';   // red
  if (progress < 0.70) return '#f59e0b';   // amber
  if (progress < 1)    return '#3b82f6';   // blue
  return '#16a34a';                         // green (100%)
}

function LiquidFill({ order, tv }: { order: Order; tv?: boolean }) {
  const progress = getFillProgress(order);
  if (progress <= 0) return null;
  const color = getFillColor(progress);
  const height = `${Math.round(progress * 100)}%`;

  return (
    <div className="liquid-fill">
      <div
        className="liquid-fill-inner"
        style={{
          height,
          background: color,
          opacity: tv ? 0.35 : 0.25,
        }}
      />
    </div>
  );
}

const LIQUID_AREAS: Area[] = ['Production', 'Logistics'];

// ============================================================
// Order Card
// ============================================================
interface OrderCardProps {
  order: Order;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  tv?: boolean;
  hasOpenIssue?: boolean;
}

export function OrderCard({ order, compact = false, onClick, selected, tv, hasOpenIssue }: OrderCardProps) {
  const orderQty = Number(order?.Order_quantity ?? 0);
  const deliveredQty = Number(order?.Delivered_quantity ?? 0);
  const progress = orderQty > 0 ? Math.round((deliveredQty / orderQty) * 100) : 0;
  const showLiquid = LIQUID_AREAS.includes(order.current_area);

  return (
    <div
      className={cn(
        'bg-card rounded-lg border cursor-pointer order-card p-3 relative',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40',
        compact && 'p-2',
        tv && showLiquid && 'tv-liquid',
        hasOpenIssue && 'order-card-issue'
      )}
      onClick={onClick}
    >
      {/* Liquid fill layer — behind content */}
      {showLiquid && <LiquidFill order={order} />}

      {/* Content — above liquid */}
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <PriorityIcon priority={order.Priority} />
            <span className="font-mono text-xs font-semibold text-foreground truncate">{String(order?.Order ?? '')}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {order.has_open_complaint && (
              <ComplaintBadge
                count={order.open_complaints_count ?? 1}
                severity={order.latest_complaint_severity}
              />
            )}
            {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
            <StatusBadge status={order.System_Status} size="sm" />
          </div>
        </div>

        {compact && (
          <div className="mt-1 min-w-0">
            {(order.Material || order.Material_description) ? (
              <>
                {order.Material && (
                  <p className="font-mono text-[10px] text-muted-foreground leading-tight truncate">
                    {String(order.Material)}
                  </p>
                )}
                {order.Material_description && (
                  <p className="text-[10px] text-muted-foreground leading-tight truncate" title={String(order.Material_description)}>
                    {String(order.Material_description)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground leading-tight">Material: N/A</p>
            )}
            {/* Logistics quantities */}
            {order.current_area === 'Logistics' && (order.prod_delivered_qty != null || order.log_received_qty != null) && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {order.prod_delivered_qty != null && <span>Del: <strong className="text-foreground">{order.prod_delivered_qty}</strong></span>}
                {order.prod_scrap_qty != null && <span>Scrap: <strong className="text-foreground">{order.prod_scrap_qty}</strong></span>}
                {order.finished_qty != null && <span>Fin: <strong className="text-foreground">{order.finished_qty}</strong></span>}
                {order.log_received_qty != null && <span>Rcvd: <strong className="text-foreground">{order.log_received_qty}</strong></span>}
              </div>
            )}
          </div>
        )}

        {!compact && (
          <>
            <div className="mt-1.5">
              <p className="text-xs text-muted-foreground truncate" title={String(order?.Material_description ?? '')}>
                {String(order?.Material_description ?? '')}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{String(order?.Plant ?? '')}</span>
              <span>{orderQty.toLocaleString()} units</span>
            </div>
            {deliveredQty > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>Delivered</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Order Detail Panel
// ============================================================
interface OrderDetailPanelProps {
  order: Order;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function OrderDetailPanel({ order, onClose, children }: OrderDetailPanelProps) {
  return (
    <div className="bg-card border border-border rounded-lg h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <PriorityIcon priority={order.Priority} />
          <div>
          <div className="flex items-center gap-2">
              <p className="font-mono font-bold text-sm">{String(order?.Order ?? '')}</p>
              {order.has_open_complaint && (
                <ComplaintBadge
                  count={order.open_complaints_count ?? 1}
                  severity={order.latest_complaint_severity}
                />
              )}
              {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
            </div>
            <AreaBadge area={order.current_area} size="sm" />
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none px-2"
          >
            ×
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="p-4 grid grid-cols-2 gap-3 text-sm border-b border-border">
        <Field label="Plant" value={String(order?.Plant ?? '')} />
        <Field label="Material" value={String(order?.Material ?? '')} mono />
        <div className="col-span-2">
          <Field label="Description" value={String(order?.Material_description ?? '')} />
        </div>
        <Field label="Sched. Start" value={String(order?.Start_date_sched ?? '')} />
        <Field label="Sched. Finish" value={String(order?.Scheduled_finish_date ?? '')} />
        <Field label="Order Qty" value={(Number(order?.Order_quantity ?? 0)).toLocaleString()} />
        <Field label="Delivered Qty" value={(Number(order?.Delivered_quantity ?? 0)).toLocaleString()} />
        <Field label="System Status" value={String(order?.System_Status ?? '')} mono />
        <Field label="User Status" value={String(order?.User_Status ?? '') || '—'} mono />
        {order.Priority && <Field label="Priority" value={order.Priority} mono />}
      </div>

      {/* Warehouse Preparation */}
      {order.is_prepared && (
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Warehouse size={12} />
            Warehouse Preparation
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Prepared by" value={order.prepared_by_username ?? '—'} />
            <Field label="Prepared at" value={order.prepared_at ? (() => { try { return format(new Date(order.prepared_at), 'dd MMM yyyy HH:mm'); } catch { return order.prepared_at; } })() : '—'} />
            {order.prepared_comment && (
              <div className="col-span-2">
                <Field label="Comment" value={order.prepared_comment} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slot for extra content (issues, etc.) */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium text-foreground', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
