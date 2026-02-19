import { Order } from '@/lib/types';
import { AreaBadge, StatusBadge } from './Badges';
import { cn } from '@/lib/utils';

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
        'bg-card rounded-lg border cursor-pointer order-card p-3',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40',
        compact && 'p-2'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{order.Order}</span>
        <StatusBadge status={order.System_Status} size="sm" />
      </div>

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
        <div>
          <p className="font-mono font-bold text-sm">{order.Order}</p>
          <AreaBadge area={order.current_area} size="sm" />
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
