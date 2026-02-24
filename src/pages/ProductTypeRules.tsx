import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig } from '@/lib/types';
import { getProductTypeRules, saveProductTypeRules, ProductTypeRule } from '@/lib/api';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Save, RefreshCw, Plus, ShieldCheck, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  config: AppConfig;
}

export default function ProductTypeRulesPage({ config }: Props) {
  const [rules, setRules] = useState<ProductTypeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProductTypeRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rules.map((r, i) => ({ ...r, _idx: i }));
    const q = search.trim().toLowerCase();
    return rules
      .map((r, i) => ({ ...r, _idx: i }))
      .filter(r => (r.rule_value ?? '').toLowerCase().includes(q) || (r.note ?? '').toLowerCase().includes(q));
  }, [rules, search]);

  const update = (idx: number, field: keyof ProductTypeRule, value: string | number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setRowErrors(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const addMaterial = () => {
    setRules(prev => [...prev, {
      id: null, rule_type: 'EXACT', rule_value: '', product_type: 'FG',
      priority: 10, is_active: 1, note: null,
    } as ProductTypeRule]);
  };

  const remove = (idx: number) => setRules(prev => prev.filter((_, i) => i !== idx));

  const validate = (): boolean => {
    const errs: Record<number, string> = {};
    const seen = new Set<string>();
    rules.forEach((r, i) => {
      const val = (r.rule_value ?? '').trim();
      if (!val) { errs[i] = 'Material is required'; return; }
      if (r.is_active) {
        if (seen.has(val)) errs[i] = `Duplicate active material: ${val}`;
        seen.add(val);
      }
    });
    setRowErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = rules.map(r => ({
        ...r,
        rule_type: 'EXACT' as const,
        rule_value: r.rule_value.trim(),
        priority: isNaN(Number(r.priority)) ? 10 : Number(r.priority),
        is_active: r.is_active ? 1 : 0,
      }));
      await saveProductTypeRules(payload as ProductTypeRule[]);
      const fresh = await getProductTypeRules();
      setRules(Array.isArray(fresh) ? fresh : []);
      toast({ title: 'Saved', description: 'Material type mappings saved.' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
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
        title="Material Type Mapping"
        subtitle="Assign each material as Finite (FG) or Semi-finished (SFG)."
      />

      <div className="bg-card border border-border rounded-lg">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search material…"
              className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-full max-w-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw size={12} /> Reload
            </button>
            <button
              onClick={addMaterial}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
            >
              <Plus size={12} /> Add Material
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save size={12} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading…" />}
        {error && <ErrorMessage message={error} onRetry={load} />}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Active</th>
                  <th className="text-left px-4 py-2.5 font-medium">Material</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium">Note</th>
                  <th className="text-left px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                    {search ? 'No matching materials.' : 'No materials defined.'}
                  </td></tr>
                )}
                {filtered.map(r => {
                  const idx = r._idx;
                  return (
                    <tr key={idx} className={cn(
                      'border-b border-border hover:bg-muted/40',
                      !r.is_active && 'opacity-50',
                      rowErrors[idx] && 'bg-destructive/5'
                    )}>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => update(idx, 'is_active', r.is_active ? 0 : 1)}
                          className={cn(
                            'w-9 h-5 rounded-full transition-colors relative',
                            r.is_active ? 'bg-primary' : 'bg-border'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-all',
                            r.is_active ? 'left-4' : 'left-0.5'
                          )} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <input
                            value={r.rule_value}
                            onChange={e => update(idx, 'rule_value', e.target.value)}
                            placeholder="e.g. 90001234"
                            className={cn(
                              'text-xs border rounded px-2 py-1 bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring w-36',
                              rowErrors[idx] ? 'border-destructive' : 'border-border'
                            )}
                          />
                          {rowErrors[idx] && (
                            <span className="text-[10px] text-destructive">{rowErrors[idx]}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={r.product_type}
                          onChange={e => update(idx, 'product_type', e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="FG">FG (Finite)</option>
                          <option value="SFG">SFG (Semi-finished)</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={r.priority}
                          onChange={e => update(idx, 'priority', Number(e.target.value))}
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-16 text-center"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={r.note ?? ''}
                          onChange={e => update(idx, 'note', e.target.value)}
                          placeholder="optional"
                          className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-48"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
