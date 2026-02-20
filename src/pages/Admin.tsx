import { useState, useEffect, useCallback } from 'react';
import { StatusMapping, Area, AREAS, AppConfig as AppConfigType, DEFAULT_ENDPOINTS, EndpointPaths } from '@/lib/types';
import { getStatusMappings, updateStatusMappings, checkHealth } from '@/lib/api';
import { loadConfig, updateConfig } from '@/lib/appConfig';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge } from '@/components/Badges';
import {
  Save, RefreshCw, Settings2, Link2, Database, ShieldCheck,
  Activity, CheckCircle2, XCircle, ChevronDown, ChevronUp,
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

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await getStatusMappings();
      setMappings(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const handleMappingChange = (id: string, field: keyof StatusMapping, value: string | boolean | number) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    setSaved(false);
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      const updated = await updateStatusMappings(mappings);
      setMappings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
    // Temporarily apply current localConfig paths for the check
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
        subtitle="Manage connection mode, API endpoints, and status mappings"
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
            {/* Health result */}
            {healthResult && (
              <div className={cn(
                'mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-md border',
                healthResult.ok
                  ? 'bg-success/10 text-success border-success/30'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              )}>
                {healthResult.ok
                  ? <CheckCircle2 size={13} />
                  : <XCircle size={13} />}
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
      <div className="bg-card border border-border rounded-lg">
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
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading mappings…" />}
        {error && <ErrorMessage message={error} onRetry={loadMappings} />}

        {!loading && !error && (
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
                {mappings.map(m => (
                  <tr key={m.id} className={cn('border-b border-border hover:bg-muted/40', !m.is_active && 'opacity-50')}>
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{m.system_status_value}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={m.mapped_area}
                        onChange={e => handleMappingChange(m.id, 'mapped_area', e.target.value as Area)}
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={m.mapped_label}
                        onChange={e => handleMappingChange(m.id, 'mapped_label', e.target.value)}
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-44"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={m.sort_order}
                        onChange={e => handleMappingChange(m.id, 'sort_order', Number(e.target.value))}
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-16 text-center"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleMappingChange(m.id, 'is_active', !m.is_active)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
