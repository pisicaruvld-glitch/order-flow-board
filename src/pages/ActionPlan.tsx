import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, MessageSquare, Mail, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ActionItem, ActionStatus, ActionPriority, ActionCreatePayload,
  listActions, createAction, updateAction,
  getActionComments, addActionComment, sendActionReminder,
  ActionComment,
} from '@/lib/actionPlanApi';
import { getUsers, OperationalUser } from '@/lib/usersApi';
import { useAuth } from '@/lib/AuthContext';

const DEPARTMENTS = ['Orders', 'Warehouse', 'Production', 'Logistics', 'Quality', 'Other'];
const STATUSES: ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const PRIORITIES: ActionPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ALL = '__ALL__';

export default function ActionPlanPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<ActionItem[]>([]);
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fDepartment, setFDepartment] = useState<string>(ALL);
  const [fResponsible, setFResponsible] = useState<string>(ALL);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [fOverdue, setFOverdue] = useState(false);
  const [fMine, setFMine] = useState(false);

  // Modals
  const [editing, setEditing] = useState<ActionItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [commentsFor, setCommentsFor] = useState<ActionItem | null>(null);

  const activeUsers = useMemo(
    () => users.filter(u => (u.is_active ?? 1) === 1),
    [users],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, usersList] = await Promise.all([
        listActions({
          department: fDepartment !== ALL ? fDepartment : undefined,
          responsible_user_id: fResponsible !== ALL ? Number(fResponsible) : undefined,
          status: fStatus !== ALL ? (fStatus as ActionStatus) : undefined,
          overdue_only: fOverdue || undefined,
          mine: fMine || undefined,
        }),
        users.length ? Promise.resolve(users) : getUsers(),
      ]);
      setItems(list);
      if (!users.length) setUsers(usersList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load action plan');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDepartment, fResponsible, fStatus, fOverdue, fMine]);

  useEffect(() => { load(); }, [load]);

  const handleReminder = async (a: ActionItem) => {
    try {
      const res = await sendActionReminder(a.id);
      if (res?.mailto_url) {
        window.location.href = res.mailto_url;
        toast({ title: 'Outlook opened', description: 'Compose the reminder email and send it manually.' });
      } else {
        toast({ title: 'No mailto returned', description: 'Backend did not return a mailto_url.', variant: 'destructive' });
      }
    } catch (e: unknown) {
      toast({ title: 'Reminder failed', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Action Plan" subtitle="Track corrective and improvement actions" />
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus size={16} /> New Action
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-4 p-4 rounded-md border bg-card">
        <FilterSelect label="Department" value={fDepartment} onChange={setFDepartment}
          options={[{ value: ALL, label: 'All' }, ...DEPARTMENTS.map(d => ({ value: d, label: d }))]} />
        <FilterSelect label="Responsible" value={fResponsible} onChange={setFResponsible}
          options={[{ value: ALL, label: 'All' }, ...activeUsers.map(u => ({ value: String(u.id), label: u.username }))]} />
        <FilterSelect label="Status" value={fStatus} onChange={setFStatus}
          options={[{ value: ALL, label: 'All' }, ...STATUSES.map(s => ({ value: s, label: s }))]} />
        <label className="flex items-center gap-2 text-sm h-10 px-2">
          <Checkbox checked={fOverdue} onCheckedChange={(v) => setFOverdue(!!v)} />
          Overdue only
        </label>
        <label className="flex items-center gap-2 text-sm h-10 px-2">
          <Checkbox checked={fMine} onCheckedChange={(v) => setFMine(!!v)} />
          My actions
        </label>
        <div className="ml-auto text-sm text-muted-foreground">
          {items.length} action{items.length === 1 ? '' : 's'}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading actions…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No actions found.</p>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead className="text-center">Comments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(a => {
                const overdue = a.delay_status === 'OVERDUE';
                return (
                  <TableRow key={a.id} className={cn(overdue && 'bg-destructive/5')}>
                    <TableCell className="font-medium max-w-[320px]">
                      <div className="truncate">{String(a.action ?? '')}</div>
                      {a.priority && (
                        <PriorityBadge priority={a.priority} />
                      )}
                    </TableCell>
                    <TableCell>{String(a.department ?? '—')}</TableCell>
                    <TableCell>{String(a.responsible_username ?? '—')}</TableCell>
                    <TableCell>{a.due_date ? String(a.due_date).slice(0, 10) : '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>
                      {overdue ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle size={12} /> OVERDUE
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{String(a.delay_status ?? 'ON_TIME')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" onClick={() => setCommentsFor(a)} className="gap-1">
                        <MessageSquare size={14} />
                        {a.comments_count ?? 0}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)} title="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReminder(a)} title="Send reminder via Outlook">
                        <Mail size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {(creating || editing) && (
        <ActionEditDialog
          action={editing}
          activeUsers={activeUsers}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {commentsFor && (
        <CommentsDrawer
          action={commentsFor}
          onClose={() => setCommentsFor(null)}
          onChange={load}
        />
      )}
    </PageContainer>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusBadge({ status }: { status: ActionStatus }) {
  const map: Record<ActionStatus, string> = {
    OPEN: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    IN_PROGRESS: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    DONE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    CANCELLED: 'bg-muted text-muted-foreground border-border',
  };
  return <Badge variant="outline" className={cn('font-medium', map[status])}>{status}</Badge>;
}

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const map: Record<ActionPriority, string> = {
    LOW: 'text-muted-foreground',
    MEDIUM: 'text-blue-600 dark:text-blue-400',
    HIGH: 'text-amber-600 dark:text-amber-400',
    CRITICAL: 'text-destructive',
  };
  return <div className={cn('text-[10px] uppercase tracking-wide mt-1', map[priority])}>{priority}</div>;
}

function ActionEditDialog({
  action, activeUsers, onClose, onSaved,
}: {
  action: ActionItem | null;
  activeUsers: OperationalUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!action;
  const [form, setForm] = useState<ActionCreatePayload>({
    action: action?.action ?? '',
    department: action?.department ?? '',
    responsible_user_id: action?.responsible_user_id ?? null,
    due_date: action?.due_date ? String(action.due_date).slice(0, 10) : '',
    priority: action?.priority ?? 'MEDIUM',
    status: action?.status ?? 'OPEN',
    description: action?.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ActionCreatePayload>(k: K, v: ActionCreatePayload[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.action?.trim()) {
      toast({ title: 'Action is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: ActionCreatePayload = {
        ...form,
        action: form.action.trim(),
        due_date: form.due_date || null,
        department: form.department || null,
        responsible_user_id: form.responsible_user_id ?? null,
      };
      if (isEdit && action) {
        await updateAction(action.id, payload);
        toast({ title: 'Action updated' });
      } else {
        await createAction(payload);
        toast({ title: 'Action created' });
      }
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Action' : 'New Action'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Action *</Label>
            <Input value={form.action} onChange={e => set('action', e.target.value)} placeholder="What needs to be done" />
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={form.department || ''} onValueChange={(v) => set('department', v)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Responsible user</Label>
            <Select
              value={form.responsible_user_id ? String(form.responsible_user_id) : ''}
              onValueChange={(v) => set('responsible_user_id', v ? Number(v) : null)}
            >
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {activeUsers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority || 'MEDIUM'} onValueChange={(v) => set('priority', v as ActionPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Status</Label>
            <Select value={form.status || 'OPEN'} onValueChange={(v) => set('status', v as ActionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentsDrawer({
  action, onClose, onChange,
}: {
  action: ActionItem;
  onClose: () => void;
  onChange: () => void;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState<ActionComment[] | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setComments(await getActionComments(action.id));
    } catch (e: unknown) {
      toast({ title: 'Failed to load comments', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [action.id, toast]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await addActionComment(action.id, text.trim());
      setText('');
      await load();
      onChange();
    } catch (e: unknown) {
      toast({ title: 'Comment failed', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">Comments</SheetTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">{String(action.action ?? '')}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <LoadingSpinner label="Loading comments…" />
          ) : !comments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{String(c.created_by ?? 'unknown')}</span>
                  <span>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{String(c.comment ?? '')}</div>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-3 space-y-2">
          <Textarea
            rows={3}
            placeholder="Add a comment…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handlePost} disabled={posting || !text.trim()}>
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
