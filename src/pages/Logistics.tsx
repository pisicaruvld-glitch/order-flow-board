import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Order, Shipment, AreaModes, CustomerShipment } from '@/lib/types';
import { getOrders, getIncomingShipments, receiveShipment, getAreaModes, moveOrder, createCustomerShipment, getCustomerShipments, getAllOpenIssueCounts } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { ShipmentCard } from '@/components/ShipmentCard';
import { LogisticsReceiveDialog } from '@/components/LogisticsReceiveDialog';
import { CustomerShipmentDialog } from '@/components/CustomerShipmentDialog';
import { MoveOrderDialog } from '@/components/MoveOrderDialog';
import { RefreshCw, ArrowLeft, Truck, ChevronDown, ChevronRight, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LogisticsPageProps {
  config: AppConfig;
}

type ReceiveDialogState = { shipment: Shipment } | null;
type CustomerShipDialogState = { orderId: string; availableToShip?: number } | null;
type MoveDialogState = { orderId: string } | null;

export default function LogisticsPage({ config }: LogisticsPageProps) {
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [incomingShipments, setIncomingShipments] = useState<Shipment[]>([]);
  const [areaModes, setAreaModes] = useState<AreaModes>({ Warehouse: 'AUTO', Production: 'AUTO', Logistics: 'AUTO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiveDialog, setReceiveDialog] = useState<ReceiveDialogState>(null);
  const [customerShipDialog, setCustomerShipDialog] = useState<CustomerShipDialogState>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null);
  // Per-order customer shipment history (lazy loaded)
  const [customerShipments, setCustomerShipments] = useState<Record<string, CustomerShipment[]>>({});
  const [expandedCustomerShipments, setExpandedCustomerShipments] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orders, shipments, modes] = await Promise.all([
        getOrders(),
        getIncomingShipments(),
        getAreaModes(),
      ]);
      setAllOrders(orders);
      setIncomingShipments(shipments);
      setAreaModes(modes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const handleCustomerShipConfirm = async (data: { shipped_qty_delta: number; shipped_by: string; shipped_doc?: string }) => {
    if (!customerShipDialog) return;
    try {
      await createCustomerShipment(customerShipDialog.orderId, data);
      toast.success('Customer shipment created');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create shipment');
      throw e;
    }
    setCustomerShipDialog(null);
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

  const toggleCustomerShipments = async (orderId: string) => {
    const next = new Set(expandedCustomerShipments);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
      // Lazy load customer shipments
      if (!customerShipments[orderId]) {
        try {
          const cs = await getCustomerShipments(orderId);
          setCustomerShipments(prev => ({ ...prev, [orderId]: cs }));
        } catch {
          // ignore
        }
      }
    }
    setExpandedCustomerShipments(next);
  };

  const isManualMode = areaModes.Logistics === 'MANUAL';

  // Section 1: Orders currently in Logistics
  const logisticsOrders = allOrders.filter(o => o.current_area === 'Logistics');

  // KPI summary
  const totalDelivered = logisticsOrders.reduce((s, o) => s + (o.prod_delivered_qty ?? 0), 0);
  const totalReceived = logisticsOrders.reduce((s, o) => s + (o.log_received_qty ?? 0), 0);
  const pendingReceive = incomingShipments.filter(s => s.received_qty_delta == null || s.received_qty_delta === 0).length;

  return (
    <PageContainer>
      <PageHeader
        title="Logistics"
        subtitle={`${logisticsOrders.length} orders · ${incomingShipments.length} incoming shipments`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/logistics/delivery-preparation')}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
            >
              <Package size={14} />Pregătire livrare
            </button>
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Total Delivered</p>
          <p className="text-2xl font-bold kpi-animate">{totalDelivered}</p>
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
          {/* Section 1: Incoming Shipments (Receive) */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Incoming (Receive) ({incomingShipments.length})</h2>
            {incomingShipments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No pending shipments. Create shipments from the Production page using "Next Step".</p>
            ) : (
              <div className="space-y-2">
                {incomingShipments.map(shipment => (
                  <ShipmentCard
                    key={shipment.id}
                    shipment={shipment}
                    onReceive={(s) => setReceiveDialog({ shipment: s })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Orders in Logistics */}
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
                        <button
                          onClick={() => setCustomerShipDialog({
                            orderId: order.Order,
                            availableToShip: order.finished_qty != null ? order.finished_qty - (order.log_received_qty ?? 0) : undefined,
                          })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Truck size={11} />
                          Ship to Customer
                        </button>
                        {isManualMode && (
                          <button
                            onClick={() => setMoveDialog({ orderId: order.Order })}
                            className="flex items-center gap-1 px-2 py-1 border border-border text-[10px] text-muted-foreground rounded hover:bg-muted transition-colors"
                          >
                            <ArrowLeft size={10} />
                            Move Back
                          </button>
                        )}
                        <button
                          onClick={() => toggleCustomerShipments(order.Order)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedCustomerShipments.has(order.Order) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          History
                        </button>
                      </div>
                    </div>

                    {/* Customer shipment history (collapsible) */}
                    {expandedCustomerShipments.has(order.Order) && (
                      <div className="mt-2 border-t border-border pt-2 space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Customer Shipments</p>
                        {(customerShipments[order.Order] ?? []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No customer shipments yet.</p>
                        ) : (
                          (customerShipments[order.Order] ?? []).map(cs => (
                            <div key={cs.id} className="flex items-center gap-3 text-[10px] bg-muted rounded px-2 py-1">
                              <span>Shipped: <strong className="text-foreground">{cs.shipped_qty_delta}</strong></span>
                              <span className="text-muted-foreground">by {cs.shipped_by}</span>
                              {cs.shipped_doc && <span className="text-muted-foreground">Doc: {cs.shipped_doc}</span>}
                              <span className="text-muted-foreground ml-auto">{new Date(cs.shipped_at).toLocaleDateString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
          orderId={receiveDialog.shipment.order_number ?? receiveDialog.shipment.order_id}
          finishedQtyDelta={receiveDialog.shipment.finished_qty_delta}
          currentReceivedQty={receiveDialog.shipment.received_qty_delta}
          onConfirm={handleReceiveConfirm}
          onCancel={() => setReceiveDialog(null)}
        />
      )}

      {/* Customer Shipment Dialog */}
      {customerShipDialog && (
        <CustomerShipmentDialog
          orderId={customerShipDialog.orderId}
          availableToShip={customerShipDialog.availableToShip}
          onConfirm={handleCustomerShipConfirm}
          onCancel={() => setCustomerShipDialog(null)}
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
