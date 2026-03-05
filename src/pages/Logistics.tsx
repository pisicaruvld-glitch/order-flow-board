import { useState, useEffect, useCallback } from 'react';
import { Order, Shipment, AreaModes } from '@/lib/types';
import { getOrders, getShipments, receiveShipment, getAreaModes, moveOrder } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { ShipmentCard } from '@/components/ShipmentCard';
import { LogisticsReceiveDialog } from '@/components/LogisticsReceiveDialog';
import { MoveOrderDialog } from '@/components/MoveOrderDialog';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LogisticsPageProps {
  config: AppConfig;
}

interface ShipmentWithOrder {
  shipment: Shipment;
  order: Order;
}

type ReceiveDialogState = { shipment: Shipment; order: Order } | null;
type MoveDialogState = { orderId: string } | null;

export default function LogisticsPage({ config }: LogisticsPageProps) {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [shipmentRows, setShipmentRows] = useState<ShipmentWithOrder[]>([]);
  const [areaModes, setAreaModes] = useState<AreaModes>({ Warehouse: 'AUTO', Production: 'AUTO', Logistics: 'AUTO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiveDialog, setReceiveDialog] = useState<ReceiveDialogState>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orders, modes] = await Promise.all([
        getOrders(),
        getAreaModes(),
      ]);
      setAllOrders(orders);
      setAreaModes(modes);

      // Find orders with shipments (prod_delivered_qty > 0 or in Logistics area)
      const relevantOrders = orders.filter(
        o => (o.prod_delivered_qty != null && o.prod_delivered_qty > 0) || o.current_area === 'Logistics'
      );

      // Fetch shipments for each relevant order
      const rows: ShipmentWithOrder[] = [];
      await Promise.all(
        relevantOrders.map(async (order) => {
          try {
            const shipments = await getShipments(order.Order);
            for (const s of shipments) {
              rows.push({ shipment: s, order });
            }
          } catch {
            // If shipments endpoint fails (e.g. DEMO mode), skip
          }
        })
      );

      // Sort by reported_at descending
      rows.sort((a, b) => new Date(b.shipment.reported_at).getTime() - new Date(a.shipment.reported_at).getTime());
      setShipmentRows(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReceive = (shipment: Shipment, order: Order) => {
    setReceiveDialog({ shipment, order });
  };

  const handleReceiveConfirm = async (data: { received_qty_delta: number; received_by: string }) => {
    if (!receiveDialog) return;
    try {
      await receiveShipment(receiveDialog.shipment.id, data);
      toast.success('Shipment received');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to receive');
      throw e;
    }
    setReceiveDialog(null);
    await load();
  };

  const handleMoveConfirm = async (justification?: string) => {
    if (!moveDialog) return;
    await moveOrder({
      order_id: moveDialog.orderId,
      target_area: 'Production',
      justification,
    });
    setMoveDialog(null);
    await load();
  };

  const isManualMode = areaModes.Logistics === 'MANUAL';

  // Cumulative summary from orders
  const logisticsOrders = allOrders.filter(o => o.current_area === 'Logistics' || (o.prod_delivered_qty != null && o.prod_delivered_qty > 0));
  const totalDelivered = logisticsOrders.reduce((s, o) => s + (o.prod_delivered_qty ?? 0), 0);
  const totalScrap = logisticsOrders.reduce((s, o) => s + (o.prod_scrap_qty ?? 0), 0);
  const totalReceived = logisticsOrders.reduce((s, o) => s + (o.log_received_qty ?? 0), 0);
  const pendingReceive = shipmentRows.filter(r => r.shipment.received_qty_delta == null || r.shipment.received_qty_delta === 0).length;

  return (
    <PageContainer>
      <PageHeader
        title="Logistics — Shipments"
        subtitle={`${shipmentRows.length} shipments from Production`}
        actions={
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded border',
              isManualMode
                ? 'bg-warning/10 text-warning border-warning/30'
                : 'bg-success/10 text-success border-success/30'
            )}>
              {isManualMode ? 'MANUAL mode' : 'AUTO mode'}
            </span>
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />Refresh
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Total Delivered</p>
          <p className="text-2xl font-bold kpi-animate">{totalDelivered}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Total Scrap</p>
          <p className="text-2xl font-bold kpi-animate">{totalScrap}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Total Received</p>
          <p className="text-2xl font-bold kpi-animate">{totalReceived}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Pending Receive</p>
          <p className="text-2xl font-bold kpi-animate">{pendingReceive}</p>
        </div>
      </div>

      {loading && <LoadingSpinner label="Loading shipments…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="space-y-2">
          {shipmentRows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No shipments yet. Create shipments from the Production page using "Next Step".
            </div>
          )}
          {shipmentRows.map(({ shipment, order }) => (
            <div key={shipment.id} className="relative">
              <ShipmentCard
                shipment={shipment}
                order={order}
                onReceive={(s) => openReceive(s, order)}
              />
              {isManualMode && (
                <button
                  onClick={() => setMoveDialog({ orderId: order.Order })}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 border border-border text-[10px] text-muted-foreground rounded hover:bg-muted transition-colors"
                >
                  <ArrowLeft size={10} />
                  Move Back
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receive Dialog */}
      {receiveDialog && (
        <LogisticsReceiveDialog
          shipmentId={receiveDialog.shipment.id}
          orderId={receiveDialog.order.Order}
          finishedQtyDelta={receiveDialog.shipment.finished_qty_delta}
          currentReceivedQty={receiveDialog.shipment.received_qty_delta}
          onConfirm={handleReceiveConfirm}
          onCancel={() => setReceiveDialog(null)}
        />
      )}

      {/* Move Dialog */}
      {moveDialog && (
        <MoveOrderDialog
          orderId={moveDialog.orderId}
          currentArea="Logistics"
          targetArea="Production"
          isNextStep={false}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMoveDialog(null)}
        />
      )}
    </PageContainer>
  );
}
