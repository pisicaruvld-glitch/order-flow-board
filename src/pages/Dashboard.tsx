import { useState, useEffect, useCallback } from 'react';
import { Order, StatusMapping, Area, AREAS } from '@/lib/types';
import { getOrders, getStatusMappings, getAreaCounts, getUniquePlants, demoMoveOrder } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge, StatusBadge } from '@/components/Badges';
import { OrderCard } from '@/components/OrderCard';
import { Search, Filter, RefreshCw, ArrowRight } from 'lucide-react';
import { DiscrepancyBadge, SourceBadge } from '@/components/MoveOrderDialog';
import { cn } from '@/lib/utils';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [movingOrder, setMovingOrder] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, m] = await Promise.all([getOrders(), getStatusMappings()]);
      setOrders(o);
      setMappings(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
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
    setMovingOrder(orderId);
    try {
      const updated = await demoMoveOrder(orderId, area);
      setOrders(prev => prev.map(o => o.Order === orderId ? updated : o));
      setSelectedOrder(updated);
    } finally {
      setMovingOrder(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Order Flow Dashboard"
        subtitle={`${filtered.length} orders across 4 areas`}
        actions={
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
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
              />
            );
          })}
        </div>
      )}
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
}

function AreaColumn({
  area, orders, subCounts, colorClass, icon,
  selectedOrder, onSelect, onMove, movingOrder, allAreas,
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
        {orders.map(order => (
          <div key={order.Order}>
            <OrderCard
              order={order}
              compact
              selected={expanded?.Order === order.Order}
              onClick={() => {
                setExpanded(expanded?.Order === order.Order ? null : order);
                onSelect(order);
              }}
            />
            {/* Expanded mini-panel */}
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
        ))}
      </div>
    </div>
  );
}
