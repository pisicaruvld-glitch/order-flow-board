import { useState, useEffect, useCallback } from 'react';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import {
  getRules, createCategory, updateCategory, deleteCategory,
  createRuleItem, updateRuleItem, deleteRuleItem,
  RulesResponse, RuleCategory, RuleItem,
} from '@/lib/rulesApi';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function RulesPage() {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRules());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageContainer><LoadingSpinner label="Loading rules…" /></PageContainer>;
  if (error) return <PageContainer><ErrorMessage message={error} onRetry={load} /></PageContainer>;
  if (!data) return null;

  const canEdit = data.can_edit;
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Rules" subtitle="Operational rules and guidelines" />
        {canEdit && <AddCategoryButton onSaved={load} />}
      </div>
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">No rules defined yet.</p>
      )}
      <div className="space-y-6">
        {categories.map(cat => (
          <CategorySection key={cat.id} category={cat} canEdit={canEdit} onRefresh={load} />
        ))}
      </div>
    </PageContainer>
  );
}

/* ── Category Section ── */
function CategorySection({ category, canEdit, onRefresh }: { category: RuleCategory; canEdit: boolean; onRefresh: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const rules = [...category.rules].sort((a, b) => a.sort_order - b.sort_order);

  const handleDelete = async () => {
    if (!confirm(`Delete category "${category.category_title}" and all its rules?`)) return;
    setDeleting(true);
    try {
      await deleteCategory(category.id);
      toast({ title: 'Deleted', description: 'Category removed.' });
      onRefresh();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          {category.category_title}
          <span className="text-xs font-normal text-muted-foreground ml-1">({rules.length} rules)</span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <AddRuleButton categoryId={category.id} onSaved={onRefresh} />
            <button onClick={() => setEditOpen(true)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
            <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
      {/* Rules */}
      {!collapsed && (
        <div className="divide-y divide-border">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground px-5 py-6 text-center">No rules in this category.</p>
          )}
          {rules.map(rule => (
            <RuleRow key={rule.id} rule={rule} canEdit={canEdit} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      {editOpen && <EditCategoryDialog category={category} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
    </div>
  );
}

/* ── Rule Row ── */
function RuleRow({ rule, canEdit, onRefresh }: { rule: RuleItem; canEdit: boolean; onRefresh: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirm(`Delete rule "${rule.rule_title}"?`)) return;
    setDeleting(true);
    try {
      await deleteRuleItem(rule.id);
      toast({ title: 'Deleted', description: 'Rule removed.' });
      onRefresh();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="px-5 py-3.5 flex items-start justify-between gap-4 group">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">{rule.rule_title}</h4>
          {rule.content && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">{rule.content}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditOpen(true)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
            <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
      {editOpen && <EditRuleDialog rule={rule} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
    </>
  );
}

/* ── Add Category Button ── */
function AddCategoryButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [sortOrder, setSortOrder] = useState(10);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => { setTitle(''); setKey(''); setSortOrder(10); };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createCategory({ category_title: title.trim(), category_key: key.trim() || title.trim().toUpperCase().replace(/\s+/g, '_'), sort_order: sortOrder, is_active: 1 });
      toast({ title: 'Created', description: 'Category added.' });
      reset();
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={14} /> Add Category</Button>
      <Dialog open={open} onOpenChange={v => { if (!v) { reset(); setOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldInput label="Title" value={title} onChange={setTitle} required />
            <FieldInput label="Key" value={key} onChange={setKey} placeholder="AUTO_GENERATED" />
            <FieldInput label="Sort Order" type="number" value={String(sortOrder)} onChange={v => setSortOrder(Number(v))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
            <Button size="sm" disabled={saving || !title.trim()} onClick={handleSave}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Add Rule Button ── */
function AddRuleButton({ categoryId, onSaved }: { categoryId: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [content, setContent] = useState('');
  const [sortOrder, setSortOrder] = useState(10);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => { setTitle(''); setKey(''); setContent(''); setSortOrder(10); };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createRuleItem({ category_id: categoryId, rule_title: title.trim(), rule_key: key.trim() || title.trim().toUpperCase().replace(/\s+/g, '_'), rule_content: content, sort_order: sortOrder, is_active: 1 });
      toast({ title: 'Created', description: 'Rule added.' });
      reset();
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Plus size={13} /></button>
      <Dialog open={open} onOpenChange={v => { if (!v) { reset(); setOpen(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Rule</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldInput label="Title" value={title} onChange={setTitle} required />
            <FieldInput label="Key" value={key} onChange={setKey} placeholder="AUTO_GENERATED" />
            <FieldTextarea label="Content" value={content} onChange={setContent} />
            <FieldInput label="Sort Order" type="number" value={String(sortOrder)} onChange={v => setSortOrder(Number(v))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
            <Button size="sm" disabled={saving || !title.trim()} onClick={handleSave}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Edit Category Dialog ── */
function EditCategoryDialog({ category, open, onClose, onSaved }: { category: RuleCategory; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(category.category_title);
  const [key, setKey] = useState(category.category_key);
  const [sortOrder, setSortOrder] = useState(category.sort_order);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCategory(category.id, { category_title: title.trim(), category_key: key.trim(), sort_order: sortOrder });
      toast({ title: 'Updated', description: 'Category saved.' });
      onClose();
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <FieldInput label="Title" value={title} onChange={setTitle} required />
          <FieldInput label="Key" value={key} onChange={setKey} />
          <FieldInput label="Sort Order" type="number" value={String(sortOrder)} onChange={v => setSortOrder(Number(v))} />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit Rule Dialog ── */
function EditRuleDialog({ rule, open, onClose, onSaved }: { rule: RuleItem; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(rule.rule_title);
  const [key, setKey] = useState(rule.rule_key);
  const [content, setContent] = useState(rule.content);
  const [sortOrder, setSortOrder] = useState(rule.sort_order);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRuleItem(rule.id, { rule_title: title.trim(), rule_key: key.trim(), rule_content: content, sort_order: sortOrder });
      toast({ title: 'Updated', description: 'Rule saved.' });
      onClose();
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit Rule</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <FieldInput label="Title" value={title} onChange={setTitle} required />
          <FieldInput label="Key" value={key} onChange={setKey} />
          <FieldTextarea label="Content" value={content} onChange={setContent} />
          <FieldInput label="Sort Order" type="number" value={String(sortOrder)} onChange={v => setSortOrder(Number(v))} />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Shared field components ── */
function FieldInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />
    </div>
  );
}
