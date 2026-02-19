import { useState, useEffect, useCallback } from 'react';
import { StatusMapping, Area, AREAS, AppConfig as AppConfigType } from '@/lib/types';
import { getStatusMappings, updateStatusMappings } from '@/lib/api';
import { loadConfig, updateConfig } from '@/lib/appConfig';
import { AppConfig } from '@/lib/types';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { AreaBadge } from '@/components/Badges';
import { Save, RefreshCw, Settings2, Link2, Database, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminPageProps {
  config: AppConfig;
  onConfigChange: (c: AppConfig) => void;
}

export default function AdminPage({ config, onConfigChange }: AdminPageProps) {
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localConfig, setLocalConfig] = useState<AppConfig>({ ...config });
  const [configSaved, setConfigSaved] = useState(false);

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
        subtitle="Manage connection mode, API, and status mappings"
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
            <input
              value={localConfig.apiBaseUrl}
              onChange={e => setLocalConfig(p => ({ ...p, apiBaseUrl: e.target.value }))}
              placeholder="http://localhost:8000/api"
              disabled={localConfig.mode === 'DEMO'}
              className={cn(
                'w-full mt-1.5 px-3 py-2 text-sm border border-border rounded-md bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring',
                localConfig.mode === 'DEMO' && 'opacity-50 cursor-not-allowed'
              )}
            />
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
