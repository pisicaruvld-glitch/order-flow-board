import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, Area, AREAS } from '@/lib/types';
import { getOrders, getBoardVersion } from '@/lib/api';
import { Radio, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Helpers
// ============================================================

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(o: Order): boolean {
  if (!o.Scheduled_finish_date) return false;
  if (o.current_area === 'Logistics') return false;
  return o.Scheduled_finish_date < todayStr();
}

function tvSort(a: Order, b: Order): number {
  const aOv = isOverdue(a) ? 0 : 1;
  const bOv = isOverdue(b) ? 0 : 1;
  if (aOv !== bOv) return aOv - bOv;
  const aF = a.Scheduled_finish_date || '9999';
  const bF = b.Scheduled_finish_date || '9999';
  if (aF !== bF) return aF < bF ? -1 : 1;
  const aC = a.has_changes ? 0 : 1;
  const bC = b.has_changes ? 0 : 1;
  return aC - bC;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const AREA_ICONS: Record<Area, string> = {
  Orders: '📋',
  Warehouse: '🏭',
  Production: '⚙️',
  Logistics: '🚛',
};

const AREA_BORDER: Record<Area, string> = {
  Orders: 'border-t-area-orders',
  Warehouse: 'border-t-area-warehouse',
  Production: 'border-t-area-production',
  Logistics: 'border-t-area-logistics',
};

const AREA_COUNT_BG: Record<Area, string> = {
  Orders: 'bg-area-orders text-primary-foreground',
  Warehouse: 'bg-area-warehouse text-warning-foreground',
  Production: 'bg-area-production text-success-foreground',
  Logistics: 'bg-area-logistics text-accent-foreground',
};

// ============================================================
// Main Component
// ============================================================
export default function TvDashboard() {
  const [searchParams] = useSearchParams();
  const interval = Math.max(2, Number(searchParams.get('interval') || '5'));
  const topN = Math.max(1, Number(searchParams.get('top') || '10'));
  const areasParam = searchParams.get('areas');
  const visibleAreas: Area[] = areasParam
    ? (areasParam.split(',').filter(a => AREAS.includes(a as Area)) as Area[])
    : [...AREAS];

  const [orders, setOrders] = useState<Order[]>([]);
  const [errorsCount, setErrorsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data loader
  const load = useCallback(async () => {
    try {
      const o = await getOrders();
      setOrders(o);
      setOffline(false);
      // Try fetching error count
      try {
        const url = `${'/api'}/errors?limit=500`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (data?.errors ?? []);
          setErrorsCount(arr.filter((e: any) => e?.severity === 'ERROR' || e?.category?.startsWith('E')).length);
        }
      } catch { /* ignore errors endpoint */ }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Polling
  const versionRef = useRef<string | null>(null);
  const isFirstPoll = useRef(true);

  useEffect(() => {
    const poll = async () => {
      const v = await getBoardVersion();
      if (!v) {
        setOffline(true);
        return;
      }
      setOffline(false);
      // Parse last_update from version string
      const parts = v.split('|');
      const lu = parts[1] || parts[0] || null;
      if (lu) setLastUpdate(lu);

      if (isFirstPoll.current) {
        versionRef.current = v;
        isFirstPoll.current = false;
        return;
      }
      if (v !== versionRef.current) {
        versionRef.current = v;
        await load();
      }
    };
    poll();
    const id = setInterval(poll, interval * 1000);
    return () => clearInterval(id);
  }, [load, interval]);

  // Derived data
  const activeOrders = useMemo(() => orders.filter(o => o.current_area !== 'HIDDEN' as any), [orders]);
  const overdueOrders = useMemo(() => activeOrders.filter(isOverdue), [activeOrders]);
  const areaOrders = useMemo(() => {
    const m: Record<Area, Order[]> = { Orders: [], Warehouse: [], Production: [], Logistics: [] };
    activeOrders.forEach(o => {
      const a = (typeof o.current_area === 'string' && m[o.current_area as Area]) ? o.current_area as Area : 'Orders';
      m[a].push(o);
    });
    // Sort each
    Object.values(m).forEach(arr => arr.sort(tvSort));
    return m;
  }, [activeOrders]);

  const kpis = useMemo(() => [
    { label: 'Total Active', value: activeOrders.length, color: 'bg-primary text-primary-foreground' },
    { label: 'Warehouse', value: areaOrders.Warehouse.length, color: AREA_COUNT_BG.Warehouse },
    { label: 'Production', value: areaOrders.Production.length, color: AREA_COUNT_BG.Production },
    { label: 'Logistics', value: areaOrders.Logistics.length, color: AREA_COUNT_BG.Logistics },
    { label: 'Overdue', value: overdueOrders.length, color: overdueOrders.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground' },
    { label: 'Errors', value: errorsCount, color: errorsCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground' },
  ], [activeOrders, areaOrders, overdueOrders, errorsCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nav-bg flex items-center justify-center">
        <div className="text-nav-fg text-2xl animate-pulse">Loading TV Dashboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Offline banner */}
      {offline && (
        <div className="bg-destructive text-destructive-foreground flex items-center justify-center gap-3 py-2 text-lg font-semibold">
          <WifiOff size={20} />
          Backend offline — retrying…
        </div>
      )}

      {/* Top bar */}
      <header className="bg-nav-bg text-nav-fg px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm tracking-wider">VS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">VSRO Order Flow – TV</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-2 text-primary">
            <Radio size={14} className="animate-pulse" />
            <span className="font-semibold">LIVE</span>
          </span>
          {lastUpdate && (
            <span className="text-nav-fg/70">
              Last update: <span className="font-mono">{lastUpdate}</span>
            </span>
          )}
          <span className="font-mono text-lg tabular-nums">{formatTime(now)}</span>
        </div>
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-6 gap-3 px-6 py-4">
        {kpis.map(k => (
          <div key={k.label} className={cn('rounded-lg p-4 flex flex-col items-center justify-center', k.color)}>
            <span className="text-4xl font-bold tabular-nums kpi-animate">{k.value}</span>
            <span className="text-sm font-medium mt-1 opacity-90">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Area columns */}
      <div className={cn(
        'flex-1 grid gap-4 px-6 pb-6 min-h-0',
        visibleAreas.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'
      )}>
        {visibleAreas.map(area => (
          <AreaColumn
            key={area}
            area={area}
            orders={areaOrders[area] ?? []}
            topN={topN}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Area Column
// ============================================================
function AreaColumn({ area, orders, topN }: { area: Area; orders: Order[]; topN: number }) {
  const top = orders.slice(0, topN);

  return (
    <div className={cn('bg-card border border-border rounded-lg flex flex-col overflow-hidden border-t-4', AREA_BORDER[area])}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{AREA_ICONS[area]}</span>
          <h2 className="text-lg font-bold">{area}</h2>
        </div>
        <span className="text-3xl font-bold tabular-nums kpi-animate">{orders.length}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {top.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No orders</p>
        )}
        {top.map(o => (
          <TvOrderRow key={o.Order} order={o} />
        ))}
        {orders.length > topN && (
          <p className="text-xs text-muted-foreground text-center py-2">
            + {orders.length - topN} more
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Order Row (TV-sized)
// ============================================================
function TvOrderRow({ order }: { order: Order }) {
  const overdue = isOverdue(order);

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-md mb-1 text-sm',
      overdue ? 'bg-destructive/10' : 'bg-muted/30'
    )}>
      {/* Overdue indicator */}
      {overdue && <AlertTriangle size={14} className="text-destructive shrink-0" />}

      {/* Order ID */}
      <span className="font-mono font-semibold w-28 shrink-0 text-foreground">{order.Order}</span>

      {/* Material */}
      <span className="font-mono text-muted-foreground w-24 shrink-0">{order.Material}</span>

      {/* Description */}
      <span className="flex-1 text-muted-foreground truncate" title={order.Material_description}>
        {truncate(order.Material_description || '—', 30)}
      </span>

      {/* Dates */}
      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
        {order.Start_date_sched || '—'}
      </span>
      <span className={cn(
        'font-mono text-xs w-20 shrink-0',
        overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
      )}>
        {order.Scheduled_finish_date || '—'}
      </span>

      {/* Changed badge */}
      {order.has_changes && (
        <span className="bg-warning text-warning-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
          CHG
        </span>
      )}
    </div>
  );
}
