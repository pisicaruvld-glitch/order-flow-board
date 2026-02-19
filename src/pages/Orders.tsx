import { useState, useCallback } from 'react';
import { Order, StatusMapping } from '@/lib/types';
import { getOrders, getStatusMappings, getAreaCounts, getUniquePlants, uploadOrders, getChangeReport } from '@/lib/api';
import { AppConfig, OrderChange, UploadResult, AREAS } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge, StatusBadge } from '@/components/Badges';
import { Upload, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrdersPageProps {
  config: AppConfig;
}

export default function OrdersPage({ config }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableLoaded, setTableLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [changeReport, setChangeReport] = useState<OrderChange[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, m] = await Promise.all([getOrders(), getStatusMappings()]);
      setOrders(o);
      setMappings(m);
      setTableLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      alert('Please upload an .xlsx file');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    setChangeReport([]);
    try {
      const result = await uploadOrders(file);
      setUploadResult(result);
      const changes = await getChangeReport(result.upload_id);
      setChangeReport(changes);
      setShowReport(true);
      await loadOrders();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filtered = orders.filter(o => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || o.Order.toLowerCase().includes(q) || o.Material.toLowerCase().includes(q) || o.Material_description.toLowerCase().includes(q);
    const matchPlant = !plantFilter || o.Plant === plantFilter;
    const matchArea = !areaFilter || o.current_area === areaFilter;
    return matchQ && matchPlant && matchArea;
  });

  const areaCounts = getAreaCounts(orders, mappings);
  const plants = getUniquePlants(orders);

  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        subtitle="Upload SAP exports and review order status"
        actions={
          tableLoaded && (
            <button onClick={loadOrders} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />
              Refresh
            </button>
          )
        }
      />

      {/* Upload Zone */}
      <UploadZone
        onFile={handleFile}
        uploading={uploading}
        dragOver={dragOver}
        setDragOver={setDragOver}
        mode={config.mode}
      />

      {/* Upload Result */}
      {uploadResult && (
        <UploadResultPanel result={uploadResult} mode={config.mode} />
      )}

      {/* Change Report */}
      {changeReport.length > 0 && uploadResult && (
        <div className="bg-card border border-border rounded-lg mb-6">
          <button
            className="w-full flex items-center justify-between p-4 text-sm font-medium"
            onClick={() => setShowReport(!showReport)}
          >
            <span className="flex items-center gap-2">
              <ChevronRight size={16} className={cn('transition-transform', showReport && 'rotate-90')} />
              Change Report — {changeReport.length} orders changed
            </span>
          </button>
          {showReport && (
            <div className="border-t border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs">
                    <th className="text-left px-4 py-2">Order</th>
                    <th className="text-left px-4 py-2">Material</th>
                    <th className="text-left px-4 py-2">Field Changed</th>
                    <th className="text-left px-4 py-2">Before</th>
                    <th className="text-left px-4 py-2">After</th>
                  </tr>
                </thead>
                <tbody>
                  {changeReport.map((c, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                      <td className="px-4 py-2 font-mono text-xs">{c.Order}</td>
                      <td className="px-4 py-2 text-xs">{c.Material}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{c.field.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-xs text-destructive line-through">{String(c.before)}</td>
                      <td className="px-4 py-2 text-xs text-success font-medium">{String(c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary by Area */}
      {tableLoaded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {AREAS.map(area => (
            <div key={area} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <AreaBadge area={area} size="sm" />
                <span className="text-xl font-bold">{orders.filter(o => o.current_area === area).length}</span>
              </div>
              <div className="space-y-0.5">
                {Object.entries(areaCounts[area] || {}).map(([label, count]) => (
                  <div key={label} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{label}</span>
                    <span className="font-medium text-foreground ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters & Table */}
      {!tableLoaded ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-sm font-medium">Upload an Excel file to load orders</p>
          <p className="text-xs mt-1">or</p>
          <button onClick={loadOrders} className="mt-2 text-sm text-primary underline hover:no-underline">
            Load current orders
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search order, material…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={plantFilter}
              onChange={e => setPlantFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Plants</option>
              {plants.map(p => <option key={p}>{p}</option>)}
            </select>
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Areas</option>
              {AREAS.map(a => <option key={a}>{a}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} orders</span>
          </div>

          {loading && <LoadingSpinner />}
          {error && <ErrorMessage message={error} onRetry={loadOrders} />}

          {!loading && !error && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                      {['Order','Plant','Material','Description','Sys. Status','User Status','Area','Start','Finish','Qty','Del. Qty'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o, i) => (
                      <tr key={o.Order} className={cn('border-b border-border hover:bg-muted/40 transition-colors', i % 2 === 0 && 'bg-background/40')}>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{o.Order}</td>
                        <td className="px-4 py-2.5 text-xs">{o.Plant}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{o.Material}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={o.Material_description}>{o.Material_description}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={o.System_Status} size="sm" /></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.User_Status || '—'}</td>
                        <td className="px-4 py-2.5"><AreaBadge area={o.current_area} size="sm" /></td>
                        <td className="px-4 py-2.5 text-xs">{o.Start_date_sched}</td>
                        <td className="px-4 py-2.5 text-xs">{o.Scheduled_finish_date}</td>
                        <td className="px-4 py-2.5 text-xs text-right font-medium">{o.Order_quantity.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-xs text-right font-medium text-success">{o.Delivered_quantity.toLocaleString()}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">No orders match your filters</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

// ============================================================
// Upload Zone
// ============================================================
function UploadZone({
  onFile, uploading, dragOver, setDragOver, mode,
}: {
  onFile: (f: File) => void;
  uploading: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  mode: string;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-lg p-6 mb-6 text-center transition-colors',
        dragOver ? 'border-primary bg-primary-subtle' : 'border-border bg-card',
        uploading && 'opacity-60 pointer-events-none'
      )}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Processing upload…</p>
          {mode === 'DEMO' && <p className="text-xs">Simulating in DEMO mode</p>}
        </div>
      ) : (
        <>
          <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Drop SAP export here</p>
          <p className="text-xs text-muted-foreground mt-0.5">Accepts .xlsx files</p>
          <label className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md cursor-pointer hover:bg-primary-light transition-colors">
            <Upload size={14} />
            Choose File
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
            />
          </label>
        </>
      )}
    </div>
  );
}

function UploadResultPanel({ result, mode }: { result: UploadResult; mode: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Upload Successful{mode === 'DEMO' ? ' (simulated)' : ''}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload ID: <code className="font-mono">{result.upload_id}</code>
          </p>
          <div className="flex gap-4 mt-2 text-sm">
            <span><strong>{result.rows_loaded}</strong> <span className="text-muted-foreground">rows loaded</span></span>
            <span><strong className="text-destructive">{result.rows_failed}</strong> <span className="text-muted-foreground">failed</span></span>
          </div>
          {result.validation_errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.validation_errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
