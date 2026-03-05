import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, StatusMapping, Area, AREAS } from '@/lib/types';
import { getOrders, getStatusMappings, getAreaCounts, getUniquePlants, demoMoveOrder, getBoardVersion, getAllOpenIssueCounts, moveOrder, createShipment } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge, StatusBadge } from '@/components/Badges';
import { OrderCard } from '@/components/OrderCard';
import { Search, Filter, RefreshCw, ArrowRight, Radio } from 'lucide-react';
import { MoveOrderDialog, DiscrepancyBadge, SourceBadge } from '@/components/MoveOrderDialog';
import { ProductionHandoverDialog } from '@/components/ProductionHandoverDialog';
// LogisticsReceiveDialog removed from Dashboard — shipment-level receive is on Logistics page
import { OrderIssueIndicator } from '@/components/OrderIssueIndicator';
import { WeekFilter, filterByWeek } from '@/components/WeekFilter';
import { cn, loadKwFilter, saveKwFilter } from '@/lib/utils';
import { toast } from 'sonner';

interface DashboardProps {
  config: AppConfig;
}

const areaColors: Record<Area, string> = {
  Orders:     'border-t-area-orders',
  Warehouse:  'border-t-area-warehouse',
  Production: 'border-t-area-production',
  Logistics:  'border-t-area-logistics',
};

const areaIcons: Record<Area, string> = {
  Orders: '📋',
  Warehouse: '🏭',
  Production: '⚙️',
  Logistics: '🚛',
};

export default function Dashboard({ config }: DashboardProps) {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [movingOrder, setMovingOrder] = useState<string | null>(null);
  const [openIssueCounts, setOpenIssueCounts] = useState<Record<string, number>>({});
  const [overrideDialog, setOverrideDialog] = useState<{ orderId: string; fromArea: Area; targetArea: Area } | null>(null);
  const [handoverDialog, setHandoverDialog] = useState<{ orderId: string; orderQty?: number; remainingQty?: number } | null>(null);
  const [receiveDialog, setReceiveDialog] = useState<{ orderId: string; finishedQty?: number } | null>(null);
  
  // KW filter: URL param overrides localStorage
  const urlKw = searchParams.get('kw');
  const [kwFilter, setKwFilter] = useState<string>(urlKw ?? loadKwFilter());
  const handleKwChange = (v: string) => {
    setKwFilter(v);
    saveKwFilter(v);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, m, ic] = await Promise.all([getOrders(), getStatusMappings(), getAllOpenIssueCounts()]);
      setOrders(o);
      setMappings(m);
      setOpenIssueCounts(ic);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Board version polling (auto-refresh) ──
  const versionRef = useRef<string | null>(null);
  const isFirstPoll = useRef(true);

  useEffect(() => {
    const poll = async () => {
      const v = await getBoardVersion();
      if (!v) return; // endpoint unavailable, skip
      if (isFirstPoll.current) {
        versionRef.current = v;
        isFirstPoll.current = false;
        return;
      }
      if (v !== versionRef.current) {
        versionRef.current = v;
        await load();
        toast('Board updated', { duration: 2000 });
      }
    };
    poll(); // initial fetch
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = filterByWeek(orders, kwFilter).filter(o => {
    const q = (searchQ ?? '').toLowerCase();
  
    const orderStr = String(o?.Order ?? '');
    const materialStr = String(o?.Material ?? '');
    const descStr = String(o?.Material_description ?? '');
  
    const matchQ =
      !q ||
      orderStr.toLowerCase().includes(q) ||
      materialStr.toLowerCase().includes(q) ||
      descStr.toLowerCase().includes(q);
  
    const matchPlant = !plantFilter || String(o?.Plant ?? '') === plantFilter;
  
    return matchQ && matchPlant;
  });

  const areaCounts = getAreaCounts(filtered, mappings);
  const plants = getUniquePlants(orders);

  const handleMove = async (orderId: string, area: Area) => {
    if (config.mode !== 'DEMO') return;
    const order = orders.find(o => o.Order === orderId);
    // Warehouse→Production with open issues: override dialog
    if (order?.current_area === 'Warehouse' && area === 'Production' && (openIssueCounts[orderId] ?? 0) > 0) {
      setOverrideDialog({ orderId, fromArea: 'Warehouse', targetArea: 'Production' });
      return;
    }
    // Production→Logistics: handover dialog
    if (order?.current_area === 'Production' && area === 'Logistics') {
      const remaining = order.remaining_qty ?? (order.Order_quantity - (order.prod_delivered_qty ?? 0));
      setHandoverDialog({ orderId, orderQty: order.Order_quantity, remainingQty: remaining });
      return;
    }
    setMovingOrder(orderId);
    try {
      const updated = await demoMoveOrder(orderId, area);
      setOrders(prev => prev.map(o => o.Order === orderId ? updated : o));
      setSelectedOrder(updated);
    } finally {
      setMovingOrder(null);
    }
  };

  const handleOverrideConfirm = async (justification?: string, movedBy?: string) => {
    if (!overrideDialog) return;
    await moveOrder({
      order_id: overrideDialog.orderId,
      target_area: overrideDialog.targetArea,
      justification,
      moved_by: movedBy,
    });
    setOrders(prev => prev.map(o =>
      o.Order === overrideDialog.orderId
        ? { ...o, current_area: overrideDialog.targetArea, source: 'manual' as const }
        : o
    ));
    setOverrideDialog(null);
  };

  const handleHandoverConfirm = async (data: { delivered_qty_delta: number; scrap_qty_delta: number; reported_by: string }) => {
    if (!handoverDialog) return;
    const result = await createShipment(handoverDialog.orderId, {
      delivered_qty_delta: data.delivered_qty_delta,
      scrap_qty_delta: data.scrap_qty_delta,
      reported_by: data.reported_by,
    });
    if (result.remaining_qty <= 0) {
      await moveOrder({
        order_id: handoverDialog.orderId,
        target_area: 'Logistics',
        justification: 'prod->logistics complete',
        moved_by: data.reported_by,
      });
    }
    setHandoverDialog(null);
    await load();
  };

  const handleReceiveConfirm = async (_data: { received_qty_delta: number; received_by: string }) => {
    // Dashboard doesn't handle shipment-level receive; use Logistics page
    setReceiveDialog(null);
    await load();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Order Flow Dashboard"
        subtitle={`${filtered.length} orders across 4 areas`}
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <Radio size={12} className="animate-pulse" />
              Live
            </span>
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search order, material…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={plantFilter}
            onChange={e => setPlantFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Plants</option>
            {plants.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <WeekFilter orders={orders} value={kwFilter} onChange={handleKwChange} />
        {config.mode === 'DEMO' && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            DEMO: Click cards to move between areas
          </span>
        )}
      </div>



      {loading && <LoadingSpinner label="Loading orders…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {AREAS.map(area => {
            const areaOrders = filtered.filter(o => o.current_area === area);
            const subCounts = areaCounts[area];
            return (
              <AreaColumn
                key={area}
                area={area}
                orders={areaOrders}
                subCounts={subCounts}
                colorClass={areaColors[area]}
                icon={areaIcons[area]}
                selectedOrder={selectedOrder}
                onSelect={setSelectedOrder}
                onMove={config.mode === 'DEMO' ? handleMove : undefined}
                movingOrder={movingOrder}
                allAreas={AREAS}
                openIssueCounts={openIssueCounts}
              />
            );
          })}
        </div>
      )}

      {/* Override dialog for Warehouse→Production with open issues */}
      {overrideDialog && (
        <MoveOrderDialog
          orderId={overrideDialog.orderId}
          currentArea={overrideDialog.fromArea}
          targetArea={overrideDialog.targetArea}
          isNextStep={true}
          overrideMode
          onConfirm={handleOverrideConfirm}
          onCancel={() => setOverrideDialog(null)}
        />
      )}

      {/* Production→Logistics handover dialog */}
      {handoverDialog && (
        <ProductionHandoverDialog
          orderId={handoverDialog.orderId}
          orderQty={handoverDialog.orderQty}
          remainingQty={handoverDialog.remainingQty}
          onConfirm={handleHandoverConfirm}
          onCancel={() => setHandoverDialog(null)}
        />
      )}

      {/* Logistics receive — shipment-level receive is on Logistics page, remove from dashboard */}
    </PageContainer>
  );
}

// ============================================================
// Area Column
// ============================================================
interface AreaColumnProps {
  area: Area;
  orders: Order[];
  subCounts: Record<string, number>;
  colorClass: string;
  icon: string;
  selectedOrder: Order | null;
  onSelect: (o: Order) => void;
  onMove?: (orderId: string, area: Area) => void;
  movingOrder: string | null;
  allAreas: Area[];
  openIssueCounts?: Record<string, number>;
}

function AreaColumn({
  area, orders, subCounts, colorClass, icon,
  selectedOrder, onSelect, onMove, movingOrder, allAreas, openIssueCounts,
}: AreaColumnProps) {
  const [expanded, setExpanded] = useState<Order | null>(null);

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden border-t-4', colorClass)}>
      {/* Column Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span>{icon}</span>
            <h2 className="font-semibold text-sm">{area}</h2>
          </div>
          <span className="text-2xl font-bold text-foreground kpi-animate">{orders.length}</span>
        </div>
        {/* Sub-counts */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(subCounts).map(([label, count]) => (
            <span key={label} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
              {label}: <strong>{count}</strong>
            </span>
          ))}
          {Object.keys(subCounts).length === 0 && (
            <span className="text-[10px] text-muted-foreground">No orders</span>
          )}
        </div>
      </div>

      {/* Order Cards */}
      <div className="p-2 flex flex-col gap-1.5 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
        {orders.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No orders</p>
        )}
        {area === 'Production' ? (
          <>
            <SubLane
              label="Semifinite"
              orders={orders.filter(o => o.product_type === 'SFG')}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelect={onSelect}
              onMove={onMove}
              movingOrder={movingOrder}
              area={area}
              allAreas={allAreas}
            />
            <div className="border-t border-border my-1" />
            <SubLane
              label="Finite"
              orders={orders.filter(o => o.product_type !== 'SFG')}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelect={onSelect}
              onMove={onMove}
              movingOrder={movingOrder}
              area={area}
              allAreas={allAreas}
            />
          </>
        ) : (
          orders.map(order => (
            <OrderCardRow
              key={order.Order}
              order={order}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelect={onSelect}
              onMove={onMove}
              movingOrder={movingOrder}
              area={area}
              allAreas={allAreas}
              openIssueCount={openIssueCounts?.[order.Order] ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// Shared card row with expand panel
// ============================================================
interface OrderCardRowProps {
  order: Order;
  expanded: Order | null;
  setExpanded: (o: Order | null) => void;
  onSelect: (o: Order) => void;
  onMove?: (orderId: string, area: Area) => void;
  movingOrder: string | null;
  area: Area;
  allAreas: Area[];
  openIssueCount?: number;
}

function OrderCardRow({ order, expanded, setExpanded, onSelect, onMove, movingOrder, area, allAreas, openIssueCount }: OrderCardRowProps) {
  return (
    <div key={order.Order} className="relative">
      {(openIssueCount ?? 0) > 0 && <OrderIssueIndicator count={openIssueCount!} />}
      <OrderCard
        order={order}
        compact
        selected={expanded?.Order === order.Order}
        hasOpenIssue={(openIssueCount ?? 0) > 0}
        onClick={() => {
          setExpanded(expanded?.Order === order.Order ? null : order);
          onSelect(order);
        }}
      />
      {expanded?.Order === order.Order && (
        <div className="bg-muted rounded-b-md px-3 py-2 border border-t-0 border-border text-xs animate-fade-in">
          {(order.discrepancy || order.source === 'manual') && (
            <div className="flex items-center gap-2 mb-1.5">
              {order.discrepancy && <DiscrepancyBadge sapArea={order.sap_area} />}
              {order.source === 'manual' && <SourceBadge source={order.source} />}
              {order.discrepancy && order.sap_area && (
                <span className="text-[10px] text-muted-foreground">SAP area: {order.sap_area}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-muted-foreground">Move to:</span>
            {onMove && allAreas.filter(a => a !== area).map(a => (
              <button
                key={a}
                onClick={() => onMove(order.Order, a)}
                disabled={movingOrder === order.Order}
                className="flex items-center gap-1 text-[10px] bg-card border border-border rounded px-2 py-0.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <ArrowRight size={10} />
                {a}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
            <span>Plant: <strong className="text-foreground">{order.Plant}</strong></span>
            <span>Qty: <strong className="text-foreground">{order.Order_quantity}</strong></span>
            <span>Start: <strong className="text-foreground">{order.Start_date_sched}</strong></span>
            <span>Finish: <strong className="text-foreground">{order.Scheduled_finish_date}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-lane for Production split
// ============================================================
interface SubLaneProps {
  label: string;
  orders: Order[];
  expanded: Order | null;
  setExpanded: (o: Order | null) => void;
  onSelect: (o: Order) => void;
  onMove?: (orderId: string, area: Area) => void;
  movingOrder: string | null;
  area: Area;
  allAreas: Area[];
}

function SubLane({ label, orders, expanded, setExpanded, onSelect, onMove, movingOrder, area, allAreas }: SubLaneProps) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">{label}</h3>
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No orders</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {orders.map(order => (
            <OrderCardRow
              key={order.Order}
              order={order}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelect={onSelect}
              onMove={onMove}
              movingOrder={movingOrder}
              area={area}
              allAreas={allAreas}
            />
          ))}
        </div>
      )}
    </div>
  );
}
