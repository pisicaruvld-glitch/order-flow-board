import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, addWeeks, addMonths, differenceInDays, startOfDay, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadConfig } from '@/lib/appConfig';

interface GanttOrder {
  order_id: string;
  plant: string;
  finish_good: string;
  finish_good_description: string;
  order_quantity: number;
  basic_start_date: string;
  basic_finish_date: string;
  start_date_sched: string;
  scheduled_finish_date: string;
  current_area: string;
  current_label: string;
  sap_area: string;
  sap_effective_status: string;
  source: string;
  product_type: string;
}

type TimeScale = 'day' | 'week' | 'month';

const AREA_COLORS: Record<string, string> = {
  Orders: 'hsl(var(--primary))',
  Warehouse: 'hsl(45 93% 47%)',
  Production: 'hsl(142 71% 45%)',
  Logistics: 'hsl(262 83% 58%)',
};

function getAreaColor(area: string): string {
  return AREA_COLORS[area] || 'hsl(var(--muted-foreground))';
}

function safeParse(d: string | undefined): Date | null {
  if (!d) return null;
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : null;
  } catch { return null; }
}

export default function GanttPage() {
  const [orders, setOrders] = useState<GanttOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [plantFilter, setPlantFilter] = useState('all');
  const [timeScale, setTimeScale] = useState<TimeScale>('week');
  const [dateFrom, setDateFrom] = useState<Date>(addDays(new Date(), -7));
  const [dateTo, setDateTo] = useState<Date>(addDays(new Date(), 28));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = loadConfig();
      const base = cfg.apiBaseUrl;
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (areaFilter !== 'all') params.set('area', areaFilter);
      if (plantFilter !== 'all') params.set('plant', plantFilter);
      params.set('date_from', format(dateFrom, 'yyyy-MM-dd'));
      params.set('date_to', format(dateTo, 'yyyy-MM-dd'));
      params.set('limit', '200');

      const token = localStorage.getItem('vsro_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${base}/gantt/orders?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[Gantt] fetch error', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, areaFilter, plantFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Derive unique areas/plants for filter dropdowns
  const areas = useMemo(() => [...new Set(orders.map(o => o.current_area).filter(Boolean))].sort(), [orders]);
  const plants = useMemo(() => [...new Set(orders.map(o => o.plant).filter(Boolean))].sort(), [orders]);

  // Timeline columns
  const timeColumns = useMemo(() => {
    const start = startOfDay(dateFrom);
    const end = startOfDay(dateTo);
    if (timeScale === 'day') {
      return eachDayOfInterval({ start, end }).map(d => ({ date: d, label: format(d, 'dd MMM'), key: format(d, 'yyyy-MM-dd') }));
    }
    if (timeScale === 'week') {
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({ date: d, label: `W${format(d, 'ww')} ${format(d, 'MMM')}`, key: format(d, 'yyyy-ww') }));
    }
    return eachMonthOfInterval({ start, end }).map(d => ({ date: d, label: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM') }));
  }, [dateFrom, dateTo, timeScale]);

  const totalDays = Math.max(differenceInDays(dateTo, dateFrom), 1);
  const colWidth = timeScale === 'day' ? 40 : timeScale === 'week' ? 100 : 120;
  const timelineWidth = timeColumns.length * colWidth;

  function getBarStyle(order: GanttOrder) {
    const s = safeParse(order.basic_start_date);
    const e = safeParse(order.basic_finish_date);
    if (!s || !e) return null;
    const startOffset = differenceInDays(s, dateFrom);
    const duration = Math.max(differenceInDays(e, s), 1);
    const left = (startOffset / totalDays) * timelineWidth;
    const width = (duration / totalDays) * timelineWidth;
    return { left: Math.max(left, 0), width: Math.max(width, 4) };
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Gantt Timeline</h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Search by Order / Finish Good</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Area</label>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Plant</label>
              <Select value={plantFilter} onValueChange={setPlantFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  {plants.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Scale</label>
              <Select value={timeScale} onValueChange={v => setTimeScale(v as TimeScale)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'dd MMM yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'dd MMM yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3">
            {Object.entries(AREA_COLORS).map(([area, color]) => (
              <div key={area} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                {area}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">No orders found for this range.</div>
          ) : (
            <div className="flex">
              {/* Left: order table */}
              <div className="shrink-0 border-r border-border" style={{ width: 420 }}>
                <div className="flex items-center h-10 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground px-3">
                  <span className="w-[90px]">Order</span>
                  <span className="w-[90px]">Finish Good</span>
                  <span className="flex-1">Description</span>
                  <span className="w-[70px] text-right">Area</span>
                </div>
                {orders.map(o => (
                  <div key={o.order_id} className="flex items-center h-9 border-b border-border text-xs px-3 hover:bg-muted/30">
                    <span className="w-[90px] font-mono truncate">{o.order_id}</span>
                    <span className="w-[90px] truncate">{o.finish_good}</span>
                    <span className="flex-1 truncate text-muted-foreground">{o.finish_good_description}</span>
                    <span className="w-[70px] text-right">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: getAreaColor(o.current_area), color: '#fff' }}>
                        {o.current_area}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Right: timeline */}
              <div className="flex-1 overflow-x-auto" ref={scrollRef}>
                <div style={{ width: timelineWidth, minWidth: '100%' }}>
                  {/* Header */}
                  <div className="flex items-center h-10 border-b border-border bg-muted/50">
                    {timeColumns.map(col => (
                      <div key={col.key} className="text-[10px] text-muted-foreground font-medium text-center border-r border-border" style={{ width: colWidth }}>
                        {col.label}
                      </div>
                    ))}
                  </div>

                  {/* Bars */}
                  {orders.map(o => {
                    const bar = getBarStyle(o);
                    return (
                      <div key={o.order_id} className="relative h-9 border-b border-border">
                        {/* Grid lines */}
                        {timeColumns.map(col => (
                          <div key={col.key} className="absolute top-0 bottom-0 border-r border-border/30" style={{ left: (differenceInDays(col.date, dateFrom) / totalDays) * timelineWidth, width: colWidth }} />
                        ))}
                        {/* Today line */}
                        {(() => {
                          const todayOff = differenceInDays(new Date(), dateFrom);
                          if (todayOff >= 0 && todayOff <= totalDays) {
                            const x = (todayOff / totalDays) * timelineWidth;
                            return <div className="absolute top-0 bottom-0 w-px bg-destructive/50" style={{ left: x }} />;
                          }
                          return null;
                        })()}
                        {bar && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-1.5 h-6 rounded cursor-default opacity-85 hover:opacity-100 transition-opacity"
                                style={{
                                  left: bar.left,
                                  width: bar.width,
                                  backgroundColor: getAreaColor(o.current_area),
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="text-xs space-y-0.5">
                                <div className="font-semibold">{o.order_id}</div>
                                <div>{o.finish_good} — {o.finish_good_description}</div>
                                <div>Start: {o.basic_start_date}</div>
                                <div>Finish: {o.basic_finish_date}</div>
                                <div>Area: {o.current_area} | Qty: {o.order_quantity}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
