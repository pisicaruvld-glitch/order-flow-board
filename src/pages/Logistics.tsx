import { useState, useEffect, useCallback } from 'react';
import { Order, LogisticsStatus, AreaModes } from '@/lib/types';
import { getOrders, getLogisticsStatus, updateLogisticsStatus, moveOrder, getAreaModes } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { StatusBadge } from '@/components/Badges';
import { PriorityIcon, ChangedBadge } from '@/components/OrderCard';
import { MoveOrderDialog, DiscrepancyBadge, SourceBadge } from '@/components/MoveOrderDialog';
import { RefreshCw, PackageCheck, Truck, Circle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogisticsPageProps {
  config: AppConfig;
}

type MoveDialogState = { orderId: string; isNextStep: boolean; blockedReason?: string } | null;

export default function LogisticsPage({ config }: LogisticsPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statuses, setStatuses] = useState<Record<string, LogisticsStatus>>({});
  const [areaModes, setAreaModes] = useState<AreaModes>({ Warehouse: 'AUTO', Production: 'AUTO', Logistics: 'AUTO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterStep, setFilterStep] = useState<'' | 'received' | 'delivered'>('');
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logisticsOrders, modes] = await Promise.all([
        getOrders({ area: 'Logistics' }),
        getAreaModes(),
      ]);
      setOrders(logisticsOrders);
      setAreaModes(modes);
      const statusMap: Record<string, LogisticsStatus> = {};
      await Promise.all(
        logisticsOrders.map(async o => {
          const s = await getLogisticsStatus(o.Order);
          statusMap[o.Order] = s || { order_id: o.Order, received_from_production: false, delivered: false };
        })
      );
      setStatuses(statusMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReceive = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const updated = await updateLogisticsStatus(orderId, {
        received_from_production: true,
        received_at: new Date().toISOString(),
        received_by: 'current_user',
      });
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
    } finally {
      setUpdating(null);
    }
  };

  const handleDeliver = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const updated = await updateLogisticsStatus(orderId, {
        delivered: true,
        delivered_at: new Date().toISOString(),
        delivered_by: 'current_user',
      });
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
    } finally {
      setUpdating(null);
    }
  };

  const openMoveBack = (order: Order) => {
    setMoveDialog({ orderId: order.Order, isNextStep: false });
  };

  const handleMoveConfirm = async (justification?: string) => {
    if (!moveDialog) return;
    await moveOrder({
      order_id: moveDialog.orderId,
      target_area: 'Production',
      justification,
    });
    setOrders(prev => prev.filter(o => o.Order !== moveDialog.orderId));
    setMoveDialog(null);
  };

  const filteredOrders = orders.filter(o => {
    const s = statuses[o.Order];
    if (filterStep === 'received') return s?.received_from_production && !s?.delivered;
    if (filterStep === 'delivered') return s?.delivered;
    return true;
  });

  const counts = {
    pending: orders.filter(o => !statuses[o.Order]?.received_from_production).length,
    received: orders.filter(o => statuses[o.Order]?.received_from_production && !statuses[o.Order]?.delivered).length,
    delivered: orders.filter(o => statuses[o.Order]?.delivered).length,
  };

  const isManualMode = areaModes.Logistics === 'MANUAL';

  return (
    <PageContainer>
      <PageHeader
        title="Logistics"
        subtitle="Track receipt from production and delivery"
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryTile
          label="Awaiting Receipt"
          count={counts.pending}
          icon={<Circle size={14} />}
          colorClass="text-muted-foreground"
          active={filterStep === ''}
          onClick={() => setFilterStep('')}
        />
        <SummaryTile
          label="Received from Production"
          count={counts.received}
          icon={<PackageCheck size={14} />}
          colorClass="text-area-warehouse"
          active={filterStep === 'received'}
          onClick={() => setFilterStep(filterStep === 'received' ? '' : 'received')}
        />
        <SummaryTile
          label="Delivered / Shipped"
          count={counts.delivered}
          icon={<Truck size={14} />}
          colorClass="text-area-logistics"
          active={filterStep === 'delivered'}
          onClick={() => setFilterStep(filterStep === 'delivered' ? '' : 'delivered')}
        />
      </div>

      {loading && <LoadingSpinner label="Loading logistics orders…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="space-y-2">
          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No orders in this view</div>
          )}
          {filteredOrders.map(order => {
            const s: LogisticsStatus = statuses[order.Order] || { order_id: order.Order, received_from_production: false, delivered: false };
            const isUpdating = updating === order.Order;
            return (
              <div key={order.Order} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <PriorityIcon priority={order.Priority} />
                        <span className="font-mono text-sm font-bold">{order.Order}</span>
                        {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
                        {order.discrepancy && <DiscrepancyBadge sapArea={order.sap_area} />}
                        {order.source === 'manual' && <SourceBadge source={order.source} />}
                      </div>
                      <StatusBadge status={order.System_Status} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{order.Material_description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{order.Plant}</span>
                      <span>Qty: <strong className="text-foreground">{order.Order_quantity.toLocaleString()}</strong></span>
                      <span>Finish: {order.Scheduled_finish_date}</span>
                    </div>
                  </div>

                  {/* Two-step tracker + actions */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    <StepIndicator
                      label="Received from Production"
                      done={s.received_from_production}
                      timestamp={s.received_at}
                      by={s.received_by}
                    />
                    <div className="w-8 h-px bg-border" />
                    <StepIndicator
                      label="Delivered / Shipped"
                      done={s.delivered}
                      timestamp={s.delivered_at}
                      by={s.delivered_by}
                    />

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 ml-2">
                      {!s.received_from_production && (
                        <button
                          onClick={() => handleReceive(order.Order)}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-area-warehouse-bg text-area-warehouse text-xs font-medium rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          <PackageCheck size={12} />
                          Receive
                        </button>
                      )}
                      {s.received_from_production && !s.delivered && (
                        <button
                          onClick={() => handleDeliver(order.Order)}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-area-logistics-bg text-area-logistics text-xs font-medium rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          <Truck size={12} />
                          Mark Delivered
                        </button>
                      )}
                      {s.delivered && (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                          <CheckCircle2 size={12} />
                          Shipped
                        </span>
                      )}
                      {isUpdating && <RefreshCw size={12} className="animate-spin text-muted-foreground mx-auto" />}

                      {/* MANUAL mode: Move Back */}
                      {isManualMode && (
                        <button
                          onClick={() => openMoveBack(order)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-xs text-muted-foreground rounded hover:bg-muted transition-colors"
                        >
                          <ArrowLeft size={11} />
                          Move Back
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Move Dialog */}
      {moveDialog && (
        <MoveOrderDialog
          orderId={moveDialog.orderId}
          currentArea="Logistics"
          targetArea="Production"
          isNextStep={false}
          blockedReason={moveDialog.blockedReason}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMoveDialog(null)}
        />
      )}
    </PageContainer>
  );
}

function SummaryTile({
  label, count, icon, colorClass, active, onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg p-4 text-left transition-colors hover:border-primary/60',
        active ? 'border-primary ring-1 ring-primary' : 'border-border'
      )}
    >
      <div className={cn('flex items-center gap-1.5 text-xs font-medium mb-2', colorClass)}>
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold kpi-animate">{count}</div>
    </button>
  );
}

function StepIndicator({
  label, done, timestamp, by,
}: {
  label: string;
  done: boolean;
  timestamp?: string;
  by?: string;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          'w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto mb-1 transition-colors',
          done ? 'border-success bg-success/10' : 'border-border bg-card'
        )}
      >
        {done ? <CheckCircle2 size={14} className="text-success" /> : <Circle size={14} className="text-muted-foreground" />}
      </div>
      <p className="text-[10px] text-muted-foreground max-w-[80px] text-center leading-tight">{label}</p>
      {done && timestamp && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(timestamp).toLocaleDateString()}</p>
      )}
      {done && by && (
        <p className="text-[10px] text-foreground font-medium">{by}</p>
      )}
    </div>
  );
}
