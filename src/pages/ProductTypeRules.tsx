import { useState, useEffect, useCallback } from 'react';
import { AppConfig } from '@/lib/types';
import { getProductTypeRules, saveProductTypeRules, ProductTypeRule } from '@/lib/api';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Save, RefreshCw, Plus, ShieldCheck, AlertTriangle, Lightbulb, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  config: AppConfig;
}

const EMPTY_RULE: Omit<ProductTypeRule, 'id'> = {
  rule_type: 'PREFIX',
  rule_value: '',
  product_type: 'SFG',
  priority: 100,
  is_active: 1,
  note: null,
};

export default function ProductTypeRulesPage({ config }: Props) {
  const [rules, setRules] = useState<ProductTypeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProductTypeRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRule = (idx: number, field: keyof ProductTypeRule, value: string | number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setRowErrors(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const addRule = (rule?: Partial<ProductTypeRule>) => {
    setRules(prev => [...prev, { ...EMPTY_RULE, id: null, ...rule } as ProductTypeRule]);
  };

  const removeRule = (idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    const errs: Record<number, string> = {};
    const activeSeen = new Set<string>();

    rules.forEach((r, i) => {
      const val = (r.rule_value ?? '').trim();
      if (!val) {
        errs[i] = 'Rule value is required';
        return;
      }
      if (r.is_active) {
        const key = `${r.rule_type}::${val}`;
        if (activeSeen.has(key)) {
          errs[i] = `Duplicate active rule: ${r.rule_type} ${val}`;
        }
        activeSeen.add(key);
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
      const sanitized = rules.map(r => ({
        ...r,
        rule_value: r.rule_value.trim(),
        priority: isNaN(Number(r.priority)) ? 100 : Number(r.priority),
        is_active: r.is_active ? 1 : 0,
      }));
      await saveProductTypeRules(sanitized as ProductTypeRule[]);
      // Re-fetch
      const fresh = await getProductTypeRules();
      setRules(Array.isArray(fresh) ? fresh : []);
      toast({ title: 'Saved', description: 'Product type rules saved successfully.' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasRecommended = rules.some(
    r => r.is_active && r.rule_type === 'PREFIX' && r.rule_value.trim() === '9'
  );

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
        title="Product Type Rules (FG / SFG)"
        subtitle="Rules classify materials into Finite (FG) or Semi-finished (SFG)."
      />

      {/* Recommended banner */}
      {!hasRecommended && !loading && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 mb-6 text-sm">
          <Lightbulb size={16} className="text-warning shrink-0" />
          <span className="text-foreground">
            <strong>Recommended:</strong> PREFIX '<code className="font-mono bg-muted px-1 rounded">9</code>' → SFG (semi-finished)
          </span>
          <button
            onClick={() => addRule({
              rule_type: 'PREFIX',
              rule_value: '9',
              product_type: 'SFG',
              priority: 10,
              is_active: 1,
              note: 'Default: material starting with 9 = semifinished',
            })}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary-light transition-colors"
          >
            <Plus size={12} />
            Add recommended rule
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Rules</h2>
            <span className="text-xs text-muted-foreground">({rules.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw size={12} /> Reload
            </button>
            <button
              onClick={() => addRule()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
            >
              <Plus size={12} /> Add Rule
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              <Save size={12} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading rules…" />}
        {error && <ErrorMessage message={error} onRetry={load} />}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Active</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rule Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rule Value</th>
                  <th className="text-left px-4 py-2.5 font-medium">Product Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium">Note</th>
                  <th className="text-left px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground text-xs py-8">No rules defined.</td></tr>
                )}
                {rules.map((r, idx) => (
                  <tr key={idx} className={cn(
                    'border-b border-border hover:bg-muted/40',
                    !r.is_active && 'opacity-50',
                    rowErrors[idx] && 'bg-destructive/5'
                  )}>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => updateRule(idx, 'is_active', r.is_active ? 0 : 1)}
                        className={cn(
                          'w-9 h-5 rounded-full transition-colors relative',
                          r.is_active ? 'bg-success' : 'bg-border'
                        )}
                      >
                        <span className={cn(
                          'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow transition-all',
                          r.is_active ? 'left-4' : 'left-0.5'
                        )} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={r.rule_type}
                        onChange={e => updateRule(idx, 'rule_type', e.target.value)}
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="PREFIX">PREFIX</option>
                        <option value="EXACT">EXACT</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <input
                          value={r.rule_value}
                          onChange={e => updateRule(idx, 'rule_value', e.target.value)}
                          className={cn(
                            'text-xs border rounded px-2 py-1 bg-card font-mono focus:outline-none focus:ring-1 focus:ring-ring w-32',
                            rowErrors[idx] ? 'border-destructive' : 'border-border'
                          )}
                        />
                        {rowErrors[idx] && (
                          <span className="text-[10px] text-destructive flex items-center gap-1">
                            <AlertTriangle size={10} /> {rowErrors[idx]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={r.product_type}
                        onChange={e => updateRule(idx, 'product_type', e.target.value)}
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
                        onChange={e => updateRule(idx, 'priority', Number(e.target.value))}
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-16 text-center"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={r.note ?? ''}
                        onChange={e => updateRule(idx, 'note', e.target.value)}
                        placeholder="optional"
                        className="text-xs border border-border rounded px-2 py-1 bg-card focus:outline-none focus:ring-1 focus:ring-ring w-48"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => removeRule(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
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
