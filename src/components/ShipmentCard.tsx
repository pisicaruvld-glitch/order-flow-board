import { Shipment, Order } from '@/lib/types';
import { PackageCheck } from 'lucide-react';

interface ShipmentCardProps {
  shipment: Shipment;
  order?: Order;
  onReceive: (shipment: Shipment) => void;
}

export function ShipmentCard({ shipment, order, onReceive }: ShipmentCardProps) {
  const remaining = shipment.remaining_to_receive_qty ?? (shipment.finished_qty_delta - (shipment.received_qty_delta ?? 0));
  const isFullyReceived = remaining <= 0;
  const isReceived = shipment.received_qty_delta != null && shipment.received_qty_delta > 0;

  // Use embedded order info from incoming-shipments endpoint, or fallback to order prop
  const orderNumber = shipment.order_number ?? order?.Order ?? shipment.order_id;
  const materialDesc = shipment.material_description ?? order?.Material_description;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold">{orderNumber}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Shipment #{shipment.id}
            </span>
          </div>
          {materialDesc && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{materialDesc}</p>
          )}

          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">Delivered: <strong className="text-foreground">{shipment.delivered_qty_delta}</strong></span>
            <span className="text-muted-foreground">Scrap: <strong className="text-foreground">{shipment.scrap_qty_delta}</strong></span>
            <span className="text-muted-foreground">Finished: <strong className="text-foreground">{shipment.finished_qty_delta}</strong></span>
            <span className="text-muted-foreground">
              Received: <strong className="text-foreground">{shipment.received_qty_delta ?? '—'}</strong>
            </span>
            {remaining > 0 && (
              <span className="text-muted-foreground">
                Remaining: <strong className="text-warning">{remaining}</strong>
              </span>
            )}
          </div>

          {/* Cumulative totals if available */}
          {(shipment.finished_qty_total != null || shipment.available_to_ship_total != null) && (
            <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
              {shipment.finished_qty_total != null && (
                <span>Total finished: <strong className="text-foreground">{shipment.finished_qty_total}</strong></span>
              )}
              {shipment.available_to_ship_total != null && (
                <span>Avail. to ship: <strong className="text-foreground">{shipment.available_to_ship_total}</strong></span>
              )}
            </div>
          )}

          {shipment.reported_by && (
            <p className="text-[10px] text-muted-foreground mt-1">
              by {shipment.reported_by} · {new Date(shipment.reported_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isReceived ? (
            <button
              onClick={() => onReceive(shipment)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
            >
              <PackageCheck size={10} />
              ✓ {shipment.received_qty_delta}
            </button>
          ) : (
            <button
              onClick={() => onReceive(shipment)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-opacity"
            >
              <PackageCheck size={12} />
              Receive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
