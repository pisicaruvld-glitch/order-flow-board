import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Order, ProductionStatus, AreaModes } from '@/lib/types';
import { getOrders, getProductionStatus, updateProductionStatus, moveOrder, getAreaModes, createShipment, getAllOpenIssueCounts, productionFinish } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { StatusBadge } from '@/components/Badges';
import { PriorityIcon, ChangedBadge } from '@/components/OrderCard';
import { MoveOrderDialog, DiscrepancyBadge, SourceBadge } from '@/components/MoveOrderDialog';
import { ProductionHandoverDialog } from '@/components/ProductionHandoverDialog';
import { RaiseComplaintDialog } from '@/components/RaiseComplaintDialog';
import { ComplaintBadge } from '@/components/ComplaintBadge';
import { SfgCompleteDialog } from '@/components/SfgCompleteDialog';
import { toast } from 'sonner';
import { RefreshCw, Play, CheckCircle2, Clock, ArrowRight, ArrowLeft, AlertTriangle, MessageSquareWarning, Warehouse, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { OrderIssueIndicator } from '@/components/OrderIssueIndicator';
import { cn } from '@/lib/utils';
import { isSFG, SfgBadge, SfgProductionQty } from '@/components/SfgBadge';

interface ProductionPageProps {
  config: AppConfig;
}

type ProdStatus = ProductionStatus['status'];
type MoveDialogState = { orderId: string; isNextStep: boolean; blockedReason?: string } | null;
type HandoverDialogState = { orderId: string; orderQty?: number; remainingQty?: number } | null;
type ComplaintDialogState = { orderId: string } | null;
type SfgCompleteDialogState = { order: Order } | null;

const statusConfig: Record<ProdStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Pending',
    color: 'bg-muted text-muted-foreground',
    icon: <Clock size={12} />,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-warning/10 text-warning',
    icon: <Play size={12} />,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-success/10 text-success',
    icon: <CheckCircle2 size={12} />,
  },
};

export default function ProductionPage({ config }: ProductionPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProductionStatus>>({});
  const [areaModes, setAreaModes] = useState<AreaModes>({ Warehouse: 'AUTO', Production: 'AUTO', Logistics: 'AUTO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProdStatus | ''>('');
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null);
  const [handoverDialog, setHandoverDialog] = useState<HandoverDialogState>(null);
  const [complaintDialog, setComplaintDialog] = useState<ComplaintDialogState>(null);
  const [sfgCompleteDialog, setSfgCompleteDialog] = useState<SfgCompleteDialogState>(null);
  const { data: openIssueCounts } = useQuery({
    queryKey: ['openIssueCounts'],
    queryFn: getAllOpenIssueCounts,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productionOrders, modes] = await Promise.all([
        getOrders({ area: 'Production' }),
        getAreaModes(),
      ]);
      setOrders(productionOrders);
      setAreaModes(modes);
      const statusMap: Record<string, ProductionStatus> = {};
      await Promise.all(
        productionOrders.map(async o => {
          const s = await getProductionStatus(o.Order);
          if (s) statusMap[o.Order] = s;
          else statusMap[o.Order] = { order_id: o.Order, status: 'PENDING', updated_at: new Date().toISOString(), updated_by: '' };
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

  // ── SFG: In Progress (no qty)
  const handleSfgInProgress = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const updated = await updateProductionStatus(orderId, { status: 'IN_PROGRESS' });
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  // ── SFG: Complete (opens qty dialog)
  const handleSfgCompleteConfirm = async (data: { gross_finished_qty: number; scrap_qty: number; updated_by: string }) => {
    if (!sfgCompleteDialog) return;
    const orderId = sfgCompleteDialog.order.Order;
    try {
      const updated = await updateProductionStatus(orderId, {
        status: 'COMPLETED',
        gross_finished_qty: data.gross_finished_qty,
        scrap_qty: data.scrap_qty,
        updated_by: data.updated_by,
      });
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
      setSfgCompleteDialog(null);
      toast.success('Production quantities reported');
      await load(); // refresh to get updated order data
    } catch (e: unknown) {
      // Re-throw so dialog can display error
      throw e;
    }
  };

  // ── SFG: Report Finished (final close, no qty)
  const handleSfgReportFinished = async (order: Order) => {
    setUpdating(order.Order);
    try {
      await productionFinish(order.Order, { reported_by: 'current_user' });
      toast.success('Order finalized and hidden from board');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to finalize');
    } finally {
      setUpdating(null);
    }
  };

  // ── FG: Status change (simple)
  const handleFgStatusChange = async (orderId: string, newStatus: ProdStatus) => {
    setUpdating(orderId);
    try {
      const updated = await updateProductionStatus(orderId, { status: newStatus });
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const openNextStep = (order: Order) => {
    const remaining = order.remaining_qty ?? (order.Order_quantity - (order.prod_delivered_qty ?? 0));
    setHandoverDialog({ orderId: order.Order, orderQty: order.Order_quantity, remainingQty: remaining });
  };

  const handleHandoverConfirm = async (data: { delivered_qty_delta: number; scrap_qty_delta: number; reported_by: string }) => {
    if (!handoverDialog) return;
    await createShipment(handoverDialog.orderId, {
      delivered_qty_delta: data.delivered_qty_delta,
      scrap_qty_delta: data.scrap_qty_delta,
      reported_by: data.reported_by,
    });
    setHandoverDialog(null);
    await load();
  };

  const openMoveBack = (order: Order) => {
    setMoveDialog({ orderId: order.Order, isNextStep: false });
  };

  const handleMoveConfirm = async (justification?: string) => {
    if (!moveDialog) return;
    const target = moveDialog.isNextStep ? 'Logistics' : 'Warehouse';
    await moveOrder({
      order_id: moveDialog.orderId,
      target_area: target,
      justification,
    });
    setOrders(prev => prev.filter(o => o.Order !== moveDialog.orderId));
    setMoveDialog(null);
  };

  const filteredOrders = orders.filter(o =>
    !filterStatus || statuses[o.Order]?.status === filterStatus
  );

  const counts = {
    PENDING: orders.filter(o => statuses[o.Order]?.status === 'PENDING').length,
    IN_PROGRESS: orders.filter(o => statuses[o.Order]?.status === 'IN_PROGRESS').length,
    COMPLETED: orders.filter(o => statuses[o.Order]?.status === 'COMPLETED').length,
  };

  const isManualMode = areaModes.Production === 'MANUAL';

  return (
    <PageContainer>
      <PageHeader
        title="Production"
        subtitle="Confirm and track production progress"
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as ProdStatus[]).map(s => {
          const cfg = statusConfig[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={cn(
                'bg-card border rounded-lg p-4 text-left transition-colors hover:border-primary/60',
                filterStatus === s ? 'border-primary ring-1 ring-primary' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full', cfg.color)}>
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>
              <div className="text-3xl font-bold kpi-animate">{counts[s]}</div>
            </button>
          );
        })}
      </div>

      {loading && <LoadingSpinner label="Loading production orders…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No production orders found</div>
          )}
          <div className="space-y-2">
            {filteredOrders.map(order => {
              const prodStatus = statuses[order.Order];
              const isUpdating = updating === order.Order;
              const cfg = prodStatus ? statusConfig[prodStatus.status] : statusConfig.PENDING;
              const issueCount = openIssueCounts?.[order.Order] ?? 0;
              const hasOpenIssue = issueCount > 0;
              const sfg = isSFG(order);
              const reportFinishedReady = prodStatus?.report_finished_ready === true;

              return (
                <div
                  key={order.Order}
                  className={cn(
                    'bg-card border rounded-lg p-4 flex items-center gap-4 hover:border-border/80 transition-colors relative',
                    sfg ? 'border-info border-2' : 'border-border',
                    hasOpenIssue && 'order-card-issue'
                  )}
                >
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <PriorityIcon priority={order.Priority} />
                        <span className="font-mono text-sm font-bold">{String(order?.Order ?? '')}</span>
                        {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
                        {order.discrepancy && <DiscrepancyBadge sapArea={order.sap_area} />}
                        {order.source === 'manual' && <SourceBadge source={order.source} />}
                        {order.has_open_complaint && (
                          <ComplaintBadge
                            count={order.open_complaints_count ?? 1}
                            severity={order.latest_complaint_severity}
                          />
                        )}
                        {hasOpenIssue && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                            <AlertTriangle size={10} />
                            {issueCount} {issueCount === 1 ? 'Issue' : 'Issues'}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={String(order?.System_Status ?? '')} size="sm" />
                      {order.is_prepared && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                          <CheckCircle2 size={10} />
                          WH READY
                        </span>
                      )}
                      {sfg && <SfgBadge />}
                      {sfg && reportFinishedReady && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                          <CheckCircle2 size={10} />
                          Completed in Production
                        </span>
                      )}
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.color)}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{String(order?.Material_description ?? '')}</p>
                    {/* Warehouse preparation info */}
                    {order.is_prepared && (
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1"><Warehouse size={10} />Prepared by: <strong className="text-foreground">{order.prepared_by_username}</strong></span>
                        {order.prepared_at && (
                          <span>at: <strong className="text-foreground">{(() => { try { return format(new Date(order.prepared_at), 'HH:mm'); } catch { return order.prepared_at; } })()}</strong></span>
                        )}
                        {order.prepared_comment && (
                          <span className="italic">"{order.prepared_comment}"</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{String(order?.Plant ?? '')}</span>
                      <span>Qty: <strong className="text-foreground">{Number(order?.Order_quantity ?? 0)}</strong></span>
                      {sfg ? (
                        <SfgProductionQty prodStatus={prodStatus} orderQty={order.Order_quantity} />
                      ) : (
                        <>
                          {(order.prod_delivered_qty != null && order.prod_delivered_qty > 0) && (
                            <>
                              <span>Delivered: <strong className="text-foreground">{order.prod_delivered_qty}</strong></span>
                              <span>Remaining: <strong className="text-foreground">{order.remaining_qty ?? (order.Order_quantity - order.prod_delivered_qty)}</strong></span>
                            </>
                          )}
                        </>
                      )}
                      <span>Start: {order.Start_date_sched}</span>
                      <span>Finish: {order.Scheduled_finish_date}</span>
                      {prodStatus?.updated_by && (
                        <span>by <strong className="text-foreground">{prodStatus.updated_by}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Raise Complaint */}
                    <button
                      onClick={() => setComplaintDialog({ orderId: order.Order })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-medium rounded hover:bg-destructive/20 transition-colors"
                    >
                      <MessageSquareWarning size={12} />
                      Complaint
                    </button>

                    {sfg ? (
                      /* ── SFG action buttons ── */
                      <>
                        {/* In Progress: available when not yet IN_PROGRESS or COMPLETED */}
                        {prodStatus?.status !== 'IN_PROGRESS' && prodStatus?.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleSfgInProgress(order.Order)}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 text-warning text-xs font-medium rounded hover:bg-warning/20 transition-colors disabled:opacity-50"
                          >
                            <Play size={12} />
                            In Progress
                          </button>
                        )}
                        {/* Complete: opens qty modal, available when IN_PROGRESS */}
                        {prodStatus?.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => setSfgCompleteDialog({ order })}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-info/10 text-info text-xs font-medium rounded hover:bg-info/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            Complete
                          </button>
                        )}
                        {/* Report Finished: only when backend says ready */}
                        {reportFinishedReady && (
                          <button
                            onClick={() => handleSfgReportFinished(order)}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded hover:bg-success/20 transition-colors disabled:opacity-50"
                          >
                            <PackageCheck size={12} />
                            {isUpdating ? 'Finishing…' : 'Report Finished'}
                          </button>
                        )}
                      </>
                    ) : (
                      /* ── FG action buttons ── */
                      <>
                        {prodStatus?.status !== 'IN_PROGRESS' && prodStatus?.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleFgStatusChange(order.Order, 'IN_PROGRESS')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 text-warning text-xs font-medium rounded hover:bg-warning/20 transition-colors disabled:opacity-50"
                          >
                            <Play size={12} />
                            In Progress
                          </button>
                        )}
                        {prodStatus?.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleFgStatusChange(order.Order, 'COMPLETED')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded hover:bg-success/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            Complete
                          </button>
                        )}
                        {prodStatus?.status === 'COMPLETED' && (
                          <span className="flex items-center gap-1 text-xs text-success font-medium">
                            <CheckCircle2 size={12} />
                            Done
                          </span>
                        )}
                      </>
                    )}

                    {isUpdating && <RefreshCw size={14} className="animate-spin text-muted-foreground" />}

                    {/* MANUAL mode flow buttons */}
                    {isManualMode && (
                      <>
                        <button
                          onClick={() => openMoveBack(order)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-xs text-muted-foreground rounded hover:bg-muted transition-colors"
                        >
                          <ArrowLeft size={11} />
                          Move Back
                        </button>
                        {!sfg && (
                          <button
                            onClick={() => openNextStep(order)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors bg-success/10 text-success hover:bg-success/20"
                          >
                            <ArrowRight size={11} />
                            Next Step
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {moveDialog && (
        <MoveOrderDialog
          orderId={moveDialog.orderId}
          currentArea="Production"
          targetArea="Warehouse"
          isNextStep={false}
          blockedReason={moveDialog.blockedReason}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMoveDialog(null)}
        />
      )}

      {/* Production→Logistics Handover Dialog (FG only) */}
      {handoverDialog && (
        <ProductionHandoverDialog
          orderId={handoverDialog.orderId}
          orderQty={handoverDialog.orderQty}
          remainingQty={handoverDialog.remainingQty}
          onConfirm={handleHandoverConfirm}
          onCancel={() => setHandoverDialog(null)}
        />
      )}

      {/* Raise Complaint Dialog */}
      {complaintDialog && (
        <RaiseComplaintDialog
          orderId={complaintDialog.orderId}
          open={!!complaintDialog}
          onOpenChange={open => { if (!open) setComplaintDialog(null); }}
          onSuccess={load}
        />
      )}

      {/* SFG Complete Dialog (qty confirmation) */}
      {sfgCompleteDialog && (
        <SfgCompleteDialog
          orderId={sfgCompleteDialog.order.Order}
          orderQty={sfgCompleteDialog.order.Order_quantity}
          onConfirm={handleSfgCompleteConfirm}
          onCancel={() => setSfgCompleteDialog(null)}
        />
      )}
    </PageContainer>
  );
}
