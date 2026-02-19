import { useState, useEffect, useCallback } from 'react';
import { Order, ProductionStatus } from '@/lib/types';
import { getOrders, getProductionStatus, updateProductionStatus } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { StatusBadge } from '@/components/Badges';
import { RefreshCw, Play, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionPageProps {
  config: AppConfig;
}

type ProdStatus = ProductionStatus['status'];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProdStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const productionOrders = await getOrders({ area: 'Production' });
      setOrders(productionOrders);
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

  const handleStatusChange = async (orderId: string, newStatus: ProdStatus) => {
    setUpdating(orderId);
    try {
      const updated = await updateProductionStatus(orderId, newStatus);
      setStatuses(prev => ({ ...prev, [orderId]: updated }));
    } finally {
      setUpdating(null);
    }
  };

  const filteredOrders = orders.filter(o =>
    !filterStatus || statuses[o.Order]?.status === filterStatus
  );

  const counts = {
    PENDING: orders.filter(o => statuses[o.Order]?.status === 'PENDING').length,
    IN_PROGRESS: orders.filter(o => statuses[o.Order]?.status === 'IN_PROGRESS').length,
    COMPLETED: orders.filter(o => statuses[o.Order]?.status === 'COMPLETED').length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="Production"
        subtitle="Confirm and track production progress"
        actions={
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw size={14} />Refresh
          </button>
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
              return (
                <div
                  key={order.Order}
                  className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:border-border/80 transition-colors"
                >
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-bold">{order.Order}</span>
                      <StatusBadge status={order.System_Status} size="sm" />
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                          cfg.color
                        )}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{order.Material_description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{order.Plant}</span>
                      <span>Qty: <strong className="text-foreground">{order.Order_quantity}</strong></span>
                      <span>Start: {order.Start_date_sched}</span>
                      <span>Finish: {order.Scheduled_finish_date}</span>
                      {prodStatus?.updated_by && (
                        <span>by <strong className="text-foreground">{prodStatus.updated_by}</strong></span>
                      )}
                      {prodStatus?.updated_at && (
                        <span>{new Date(prodStatus.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {prodStatus?.status !== 'IN_PROGRESS' && prodStatus?.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleStatusChange(order.Order, 'IN_PROGRESS')}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 text-warning text-xs font-medium rounded hover:bg-warning/20 transition-colors disabled:opacity-50"
                      >
                        <Play size={12} />
                        In Progress
                      </button>
                    )}
                    {prodStatus?.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleStatusChange(order.Order, 'COMPLETED')}
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
                    {isUpdating && <RefreshCw size={14} className="animate-spin text-muted-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageContainer>
  );
}
