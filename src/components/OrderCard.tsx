import { Order } from '@/lib/types';
import { AreaBadge, StatusBadge } from './Badges';
import { cn } from '@/lib/utils';
import { Slash, Circle, X, GitCompareArrows } from 'lucide-react';

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
// Order Card
// ============================================================
interface OrderCardProps {
  order: Order;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

export function OrderCard({ order, compact = false, onClick, selected }: OrderCardProps) {
  const progress =
    order.Order_quantity > 0
      ? Math.round((order.Delivered_quantity / order.Order_quantity) * 100)
      : 0;

  return (
    <div
      className={cn(
        'bg-card rounded-lg border cursor-pointer order-card p-3 relative',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40',
        compact && 'p-2'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <PriorityIcon priority={order.Priority} />
          <span className="font-mono text-xs font-semibold text-foreground truncate">{order.Order}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
          <StatusBadge status={order.System_Status} size="sm" />
        </div>
      </div>

      {compact && (
        <div className="mt-1 min-w-0">
          {order.Material || order.Material_description ? (
            <>
              {order.Material && (
                <p className="font-mono text-[10px] text-muted-foreground leading-tight truncate">
                  {order.Material}
                </p>
              )}
              {order.Material_description && (
                <p className="text-[10px] text-muted-foreground leading-tight truncate" title={order.Material_description}>
                  {order.Material_description}
                </p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground leading-tight">Material: N/A</p>
          )}
        </div>
      )}

      {!compact && (
        <>
          <div className="mt-1.5">
            <p className="text-xs text-muted-foreground truncate" title={order.Material_description}>
              {order.Material_description}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{order.Plant}</span>
            <span>{order.Order_quantity.toLocaleString()} units</span>
          </div>
          {order.Delivered_quantity > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Delivered</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
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
              <p className="font-mono font-bold text-sm">{order.Order}</p>
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
        <Field label="Plant" value={order.Plant} />
        <Field label="Material" value={order.Material} mono />
        <div className="col-span-2">
          <Field label="Description" value={order.Material_description} />
        </div>
        <Field label="Sched. Start" value={order.Start_date_sched} />
        <Field label="Sched. Finish" value={order.Scheduled_finish_date} />
        <Field label="Order Qty" value={order.Order_quantity.toLocaleString()} />
        <Field label="Delivered Qty" value={order.Delivered_quantity.toLocaleString()} />
        <Field label="System Status" value={order.System_Status} mono />
        <Field label="User Status" value={order.User_Status || '—'} mono />
        {order.Priority && <Field label="Priority" value={order.Priority} mono />}
      </div>

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
