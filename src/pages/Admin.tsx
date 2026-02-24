import { useState, useEffect, useCallback } from 'react';
import { StatusMapping, Area, AREAS, AppConfig as AppConfigType, DEFAULT_ENDPOINTS, EndpointPaths, AreaModes, DEFAULT_AREA_MODES, FLOW_AREAS } from '@/lib/types';

/** Allowed board areas for the Status → Area mapping dropdown (aligned with backend) */
const MAPPING_AREAS = ['Orders', 'Warehouse', 'Production', 'Logistics'] as const;
type MappingArea = (typeof MAPPING_AREAS)[number];

/** Normalize legacy area values */
function normalizeMappedArea(area: string): MappingArea {
  const MIGRATION: Record<string, MappingArea> = {
    'Planning': 'Orders',
    'Deliveries': 'Logistics',
  };
  if (MIGRATION[area]) return MIGRATION[area];
  if ((MAPPING_AREAS as readonly string[]).includes(area)) return area as MappingArea;
  return 'Orders'; // fallback
}
import { getStatusMappings, updateStatusMappings, applyStatusMappings, checkHealth, getEffectiveStatus, getAreaModes, saveAreaModes } from '@/lib/api';
import { loadConfig, updateConfig } from '@/lib/appConfig';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge } from '@/components/Badges';
import {
  Save, RefreshCw, Settings2, Link2, Database, ShieldCheck,
  Activity, CheckCircle2, XCircle, ChevronDown, ChevronUp, Eye, ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminPageProps {
  config: AppConfig;
  onConfigChange: (c: AppConfig) => void;
}

type HealthResult = { ok: boolean; message: string } | null;

export default function AdminPage({ config, onConfigChange }: AdminPageProps) {
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localConfig, setLocalConfig] = useState<AppConfig>({ ...config });
  const [configSaved, setConfigSaved] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthResult>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [endpointsExpanded, setEndpointsExpanded] = useState(false);

  // Area modes
  const [areaModes, setAreaModes] = useState<AreaModes>({ ...DEFAULT_AREA_MODES });
  const [modesSaving, setModesSaving] = useState(false);
  const [modesSaved, setModesSaved] = useState(false);
  const [modesLocal, setModesLocal] = useState(false);

  // Status preview tool
  const [previewStatus, setPreviewStatus] = useState('');
  const [previewResult, setPreviewResult] = useState<{ effectiveStatus: string; area: Area; label: string } | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, modes] = await Promise.all([
        getStatusMappings().then(d => Array.isArray(d) ? d : []),
        getAreaModes().catch(() => ({ ...DEFAULT_AREA_MODES })),
      ]);
      // Normalize legacy area values and mark dirty rows
      const normalized = m.map(row => {
        const norm = normalizeMappedArea(row.mapped_area);
        return norm !== row.mapped_area ? { ...row, mapped_area: norm as Area } : row;
      });
      setMappings(normalized);
      setAreaModes(modes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const handleMappingChange = (rowKey: string, field: keyof StatusMapping, value: string | boolean | number) => {
    setMappings(prev => prev.map(m =>
      (m.row_key ?? m.id) === rowKey ? { ...m, [field]: value } : m
    ));
    setSaved(false);
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    setError(null);
    try {
      // Ensure all mapped_area values are valid before saving
      const sanitized = mappings.map(m => ({
        ...m,
        mapped_area: normalizeMappedArea(m.mapped_area) as Area,
      }));
      // 1) Save mappings
      await updateStatusMappings(sanitized);
      // 2) Apply (recompute order areas)
      try {
        await applyStatusMappings();
      } catch (applyErr: unknown) {
        const applyMsg = applyErr instanceof Error ? applyErr.message : 'Apply failed';
        setError(`Mappings saved, but apply failed: ${applyMsg}`);
      }
      // 3) Re-fetch the authoritative list from the backend
      const fresh = await getStatusMappings();
      const freshArray = Array.isArray(fresh) ? fresh : [];
      const normalized = freshArray.map(row => {
        const norm = normalizeMappedArea(row.mapped_area);
        return norm !== row.mapped_area ? { ...row, mapped_area: norm as Area } : row;
      });
      setMappings(normalized);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = () => {
    const updated = updateConfig(localConfig);
    onConfigChange(updated);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setHealthChecking(true);
    setHealthResult(null);
    const savedConfig = updateConfig(localConfig);
    onConfigChange(savedConfig);
    const result = await checkHealth();
    setHealthResult(result);
    setHealthChecking(false);
  };

  const setEndpoint = (key: keyof EndpointPaths, value: string) => {
    setLocalConfig(p => ({
      ...p,
      endpoints: { ...p.endpoints, [key]: value },
    }));
  };

  const resetEndpoints = () => {
    setLocalConfig(p => ({ ...p, endpoints: { ...DEFAULT_ENDPOINTS } }));
  };

  const handleSaveAreaModes = async () => {
    setModesSaving(true);
    try {
      const result = await saveAreaModes(areaModes);
      setModesSaved(true);
      setModesLocal(result.local);
      setTimeout(() => { setModesSaved(false); setModesLocal(false); }, 3000);
    } finally {
      setModesSaving(false);
    }
  };

  const handlePreview = () => {
    if (!previewStatus.trim()) return;
    const eff = getEffectiveStatus(previewStatus.trim(), mappings);
    if (eff) {
      setPreviewResult({ effectiveStatus: eff.system_status_value, area: eff.mapped_area, label: eff.mapped_label });
    } else {
      setPreviewResult({ effectiveStatus: '(no match)', area: 'Orders' as Area, label: 'Unmapped → defaults to Orders' });
    }
  };

  if (config.userRole !== 'admin') {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <ShieldCheck size={36} />
          <p className="text-sm font-medium">Admin access required</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Admin Settings"
        subtitle="Manage connection mode, API endpoints, area modes, and status mappings"
        actions={
          <a
            href="/admin/product-type-rules"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded border border-border hover:border-primary/50 transition-colors"
          >
            Product Type Rules →
          </a>
        }
      />

      {/* Connection Settings */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Settings2 size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Connection Settings</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Mode Toggle */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mode</label>
            <div className="flex gap-3 mt-2">
              {(['DEMO', 'LIVE'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setLocalConfig(p => ({ ...p, mode }))}
                  className={cn(
                    'flex-1 py-2.5 rounded-md border text-sm font-medium transition-colors',
                    localConfig.mode === mode
                      ? mode === 'DEMO'
                        ? 'bg-[hsl(var(--banner-demo))] text-[hsl(var(--banner-demo-fg))] border-transparent'
                        : 'bg-[hsl(var(--banner-live))] text-[hsl(var(--banner-live-fg))] border-transparent'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {mode === 'DEMO' ? '📡 DEMO (Mock Data)' : '🔗 LIVE (REST API)'}
                </button>
              ))}
            </div>
            {localConfig.mode === 'DEMO' && (
              <p className="text-xs text-muted-foreground mt-2">
                In DEMO mode, all data is simulated in-app. No network requests are made.
              </p>
            )}
          </div>

          {/* API Base URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Link2 size={12} />
              API Base URL
            </label>
            <div className="flex gap-2 mt-1.5">
              <input
                value={localConfig.apiBaseUrl}
                onChange={e => setLocalConfig(p => ({ ...p, apiBaseUrl: e.target.value }))}
                placeholder="http://localhost:8000/api"
                disabled={localConfig.mode === 'DEMO'}
                className={cn(
                  'flex-1 px-3 py-2 text-sm border border-border rounded-md bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring',
                  localConfig.mode === 'DEMO' && 'opacity-50 cursor-not-allowed'
                )}
              />
              {localConfig.mode === 'LIVE' && (
                <button
                  onClick={handleTestConnection}
                  disabled={healthChecking}
                  className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-medium rounded-md border border-border hover:border-primary/50 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Activity size={13} />
                  {healthChecking ? 'Testing…' : 'Test Connection'}
                </button>
              )}
            </div>
            {healthResult && (
              <div className={cn(
                'mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-md border',
                healthResult.ok
                  ? 'bg-success/10 text-success border-success/30'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              )}>
                {healthResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {healthResult.message}
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              User Role (dev override)
            </label>
            <select
              value={localConfig.userRole}
              onChange={e => setLocalConfig(p => ({ ...p, userRole: e.target.value as 'admin' | 'user' }))}
              className="mt-1.5 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <button
            onClick={handleSaveConfig}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary-light transition-colors"
          >
            <Save size={14} />
            {configSaved ? '✓ Saved!' : 'Save Connection Settings'}
          </button>
          {configSaved && (
            <p className="text-xs text-success">Settings saved. Page will reflect changes.</p>
          )}
        </div>
      </div>

      {/* Area Modes */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <ToggleRight size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Area Modes</h2>
          <span className="text-xs text-muted-foreground">(AUTO = status-driven, MANUAL = user moves orders)</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Orders — always AUTO */}
            <div className="bg-muted/40 border border-border rounded-lg p-3 opacity-70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Orders</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">AUTO (locked)</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Orders area is always auto-populated from SAP status mapping.
              </p>
            </div>

            {/* Configurable areas */}
            {(FLOW_AREAS as Array<'Warehouse' | 'Production' | 'Logistics'>).map(area => (
              <div
                key={area}
                className={cn(
                  'border rounded-lg p-3 transition-colors',
                  areaModes[area] === 'MANUAL'
                    ? 'border-warning/50 bg-warning/5'
                    : 'border-border bg-card'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{area}</span>
                  <button
                    onClick={() => setAreaModes(prev => ({
                      ...prev,
                      [area]: prev[area] === 'AUTO' ? 'MANUAL' : 'AUTO',
                    }))}
                    className={cn(
                      'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors',
                      areaModes[area] === 'MANUAL'
                        ? 'bg-warning/15 text-warning border-warning/40'
                        : 'bg-success/10 text-success border-success/30'
                    )}
                  >
                    {areaModes[area] === 'MANUAL' ? <ToggleRight size={10} /> : <ToggleLeft size={10} />}
                    {areaModes[area]}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {areaModes[area] === 'AUTO'
                    ? 'Area set automatically from SAP status on each upload.'
                    : 'Users manually move orders with Next Step / Move Back.'}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAreaModes}
              disabled={modesSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {modesSaving ? 'Saving…' : modesSaved ? '✓ Saved!' : 'Save Area Modes'}
            </button>
            {modesSaved && modesLocal && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle size={12} />
                Saved locally only (backend endpoint not available)
              </div>
            )}
            {modesSaved && !modesLocal && (
              <span className="text-xs text-success">Saved to backend</span>
            )}
          </div>
        </div>
      </div>

      {/* Endpoint Mapping */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <button
          className="w-full flex items-center justify-between px-4 py-3 border-b border-border"
          onClick={() => setEndpointsExpanded(e => !e)}
        >
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Endpoint Path Mapping</h2>
            <span className="text-xs text-muted-foreground">
              {localConfig.mode === 'DEMO' ? '(not used in DEMO mode)' : '(relative to API Base URL)'}
            </span>
          </div>
          {endpointsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {endpointsExpanded && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{'{'+'order_id'+'}'}</code> and <code className="bg-muted px-1 rounded">{'{'+'issue_id'+'}'}</code> as path variables.
            </p>
            {(Object.entries(localConfig.endpoints) as [keyof EndpointPaths, string][]).map(([key, val]) => (
              <EndpointField
                key={key}
                fieldKey={key}
                value={val}
                defaultValue={DEFAULT_ENDPOINTS[key]}
                onChange={v => setEndpoint(key, v)}
                disabled={localConfig.mode === 'DEMO'}
              />
            ))}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveConfig}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary-light transition-colors"
              >
                <Save size={14} />
                Save Endpoints
              </button>
              <button
                onClick={resetEndpoints}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={12} />
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Mappings */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Status → Area Mapping</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadMappings}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={12} />
              Reload
            </button>
            <button
              onClick={handleSaveMappings}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              <Save size={12} />
              {saving ? 'Saving & Applying…' : saved ? '✓ Saved & Applied!' : 'Save & Apply'}
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading mappings…" />}
        {error && <ErrorMessage message={error} onRetry={loadMappings} />}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium">System Status Value</th>
                    <th className="text-left px-4 py-2.5 font-medium">Mapped Area</th>
                    <th className="text-left px-4 py-2.5 font-medium">Label</th>
                    <th className="text-left px-4 py-2.5 font-medium">Sort Order</th>
                    <th className="text-left px-4 py-2.5 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(m => {
                    const rowKey = m.row_key ?? m.id;
                    return (
                    <tr key={rowKey} className={cn('border-b border-border hover:bg-muted/40', !m.is_active && 'opacity-50')}>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{m.system_status_value}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={normalizeMappedArea(m.mapped_area)}
                          onChange={e => handleMappingChange(rowKey, 'mapped_area', e.target.value as Area)}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {MAPPING_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={m.mapped_label}
                          onChange={e => handleMappingChange(rowKey, 'mapped_label', e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-44"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={m.sort_order}
                          onChange={e => handleMappingChange(rowKey, 'sort_order', Number(e.target.value))}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-16 text-center"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMappingChange(rowKey, 'is_active', !m.is_active)}
                            className={cn(
                              'w-9 h-5 rounded-full transition-colors relative',
                              m.is_active ? 'bg-success' : 'bg-border'
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-all',
                                m.is_active ? 'left-4' : 'left-0.5'
                              )}
                            />
                          </button>
                          {!m.is_active && (
                            <span className="text-[10px] text-muted-foreground italic">Hidden</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Status Preview Tool */}
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye size={14} className="text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status Mapping Preview Tool
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter a System Status string (e.g., <code className="bg-muted px-1 rounded">REL PRT PCNF</code>) to see which effective status and area would be assigned.
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  value={previewStatus}
                  onChange={e => { setPreviewStatus(e.target.value); setPreviewResult(null); }}
                  placeholder="e.g., REL PRT PCNF"
                  className="px-3 py-1.5 text-sm border border-border rounded-md bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring w-64"
                  onKeyDown={e => { if (e.key === 'Enter') handlePreview(); }}
                />
                <button
                  onClick={handlePreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded border border-border hover:border-primary/50 transition-colors"
                >
                  <Eye size={12} />
                  Preview
                </button>
                {previewResult && (
                  <div className="flex items-center gap-3 text-xs bg-muted rounded px-3 py-1.5 border border-border">
                    <span className="text-muted-foreground">Effective status:</span>
                    <code className="font-mono font-semibold text-foreground">{previewResult.effectiveStatus}</code>
                    <span className="text-muted-foreground">→</span>
                    <AreaBadge area={previewResult.area} size="sm" />
                    <span className="text-muted-foreground">{previewResult.label}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

// ============================================================
// Endpoint Field helper
// ============================================================
const ENDPOINT_LABELS: Record<string, string> = {
  healthPath: 'Health check path',
  ordersPath: 'Orders path',
  uploadOrdersPath: 'Upload orders path',
  statusMappingPath: 'Status mapping path',
  orderTimelinePath: 'Order timeline path',
  orderIssuesPath: 'Order issues path',
  issuePath: 'Issue (single) path',
  issueHistoryPath: 'Issue history path',
  moveOrderPath: 'Move order path',
  areaModesPath: 'Area modes settings path',
};

function EndpointField({
  fieldKey,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  fieldKey: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const isDirty = value !== defaultValue;
  return (
    <div>
      <label className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{ENDPOINT_LABELS[fieldKey] ?? fieldKey}</span>
        {isDirty && (
          <button
            onClick={() => onChange(defaultValue)}
            className="text-[10px] text-primary hover:underline"
          >
            Reset
          </button>
        )}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-1.5 text-xs border rounded-md bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring',
          isDirty ? 'border-primary/50' : 'border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
    </div>
  );
}
