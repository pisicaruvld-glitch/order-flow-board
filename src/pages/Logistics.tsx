import { useState, useEffect, useCallback } from 'react';
import { Order, Shipment, AreaModes } from '@/lib/types';
import { getOrders, getShipments, receiveShipment, getAreaModes, moveOrder } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { OrderCard } from '@/components/OrderCard';
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

      // Collect order IDs that are currently in Logistics (to dedup)
      const logisticsOrderIds = new Set(
        orders.filter(o => o.current_area === 'Logistics').map(o => o.Order)
      );

      // Find orders NOT in Logistics but with shipments (prod_delivered_qty > 0)
      const ordersWithShipments = orders.filter(
        o => !logisticsOrderIds.has(o.Order) && o.prod_delivered_qty != null && o.prod_delivered_qty > 0
      );

      // Fetch shipments for those orders only
      const rows: ShipmentWithOrder[] = [];
      await Promise.all(
        ordersWithShipments.map(async (order) => {
          try {
            const shipments = await getShipments(order.Order);
            for (const s of shipments) {
              rows.push({ shipment: s, order });
            }
          } catch {
            // skip on error
          }
        })
      );

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

  // Section 1: Orders currently in Logistics
  const logisticsOrders = allOrders.filter(o => o.current_area === 'Logistics');

  // Cumulative summary
  const allRelevant = allOrders.filter(o => o.current_area === 'Logistics' || (o.prod_delivered_qty != null && o.prod_delivered_qty > 0));
  const totalDelivered = allRelevant.reduce((s, o) => s + (o.prod_delivered_qty ?? 0), 0);
  const totalScrap = allRelevant.reduce((s, o) => s + (o.prod_scrap_qty ?? 0), 0);
  const totalReceived = allRelevant.reduce((s, o) => s + (o.log_received_qty ?? 0), 0);
  const pendingReceive = shipmentRows.filter(r => r.shipment.received_qty_delta == null || r.shipment.received_qty_delta === 0).length;

  return (
    <PageContainer>
      <PageHeader
        title="Logistics"
        subtitle={`${logisticsOrders.length} orders · ${shipmentRows.length} incoming shipments`}
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

      {loading && <LoadingSpinner label="Loading logistics…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Section 1: Orders in Logistics */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Orders in Logistics ({logisticsOrders.length})</h2>
            {logisticsOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No orders currently in Logistics.</p>
            ) : (
              <div className="space-y-2">
                {logisticsOrders.map(order => (
                  <div key={order.Order} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold">{order.Order}</span>
                          {order.Material_description && (
                            <span className="text-[10px] text-muted-foreground truncate">{order.Material_description}</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px]">
                          {order.prod_delivered_qty != null && <span className="text-muted-foreground">Delivered: <strong className="text-foreground">{order.prod_delivered_qty}</strong></span>}
                          {order.prod_scrap_qty != null && <span className="text-muted-foreground">Scrap: <strong className="text-foreground">{order.prod_scrap_qty}</strong></span>}
                          {order.finished_qty != null && <span className="text-muted-foreground">Finished: <strong className="text-foreground">{order.finished_qty}</strong></span>}
                          <span className="text-muted-foreground">Received: <strong className="text-foreground">{order.log_received_qty ?? '—'}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {isManualMode && (
                          <button
                            onClick={() => setMoveDialog({ orderId: order.Order })}
                            className="flex items-center gap-1 px-2 py-1 border border-border text-[10px] text-muted-foreground rounded hover:bg-muted transition-colors"
                          >
                            <ArrowLeft size={10} />
                            Move Back
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Incoming Shipments */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Incoming Shipments ({shipmentRows.length})</h2>
            {shipmentRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No incoming shipments. Create shipments from the Production page using "Next Step".</p>
            ) : (
              <div className="space-y-2">
                {shipmentRows.map(({ shipment, order }) => (
                  <ShipmentCard
                    key={shipment.id}
                    shipment={shipment}
                    order={order}
                    onReceive={(s) => openReceive(s, order)}
                  />
                ))}
              </div>
            )}
          </section>
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
