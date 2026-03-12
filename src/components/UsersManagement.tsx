import { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUser, OperationalUser, UserArea, CreateUserPayload, UpdateUserPayload } from '@/lib/usersApi';
import { LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALL_AREAS: UserArea[] = ['Orders', 'Warehouse', 'Production', 'Logistics'];

export default function UsersManagement() {
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OperationalUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditingUser(null); setDialogOpen(true); };
  const openEdit = (u: OperationalUser) => { setEditingUser(u); setDialogOpen(true); };

  const handleSave = async (data: CreateUserPayload) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.user_id, data as UpdateUserPayload);
        toast.success('User updated');
      } else {
        await createUser(data);
        toast.success('User created');
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save user');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Users</h2>
          <span className="text-xs text-muted-foreground">({users.length})</span>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openAdd}>
          <Plus size={12} /> Add User
        </Button>
      </div>

      {loading && <LoadingSpinner label="Loading users…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Username</th>
                <th className="text-left px-4 py-2.5 font-medium">Areas</th>
                <th className="text-left px-4 py-2.5 font-medium">Active</th>
                <th className="text-left px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8 text-xs">No users found</td></tr>
              )}
              {users.map(u => (
                <tr key={u.user_id} className={cn('border-b border-border hover:bg-muted/40', !u.is_active && 'opacity-50')}>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{u.user_id}</td>
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(u.areas ?? []).map(a => (
                        <span key={a} className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                      {(!u.areas || u.areas.length === 0) && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                      u.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-success' : 'bg-muted-foreground')} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openEdit(u)}>
                      <Pencil size={12} /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <UserForm
            initial={editingUser}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: OperationalUser | null;
  onSave: (data: CreateUserPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password_text ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? 1);
  const [areas, setAreas] = useState<UserArea[]>(initial?.areas ?? []);
  const [saving, setSaving] = useState(false);

  const toggleArea = (area: UserArea) => {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      await onSave({ username: username.trim(), password_text: password, is_active: isActive, areas });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Username</label>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. maria.pop" className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Password</label>
        <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Areas</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {ALL_AREAS.map(area => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded border transition-colors',
                areas.includes(area)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {area}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => setIsActive(1)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded border transition-colors',
              isActive ? 'bg-success/10 text-success border-success/30' : 'bg-card text-muted-foreground border-border'
            )}
          >Active</button>
          <button
            type="button"
            onClick={() => setIsActive(0)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded border transition-colors',
              !isActive ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-card text-muted-foreground border-border'
            )}
          >Inactive</button>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={saving || !username.trim()} className="flex-1 gap-1.5">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial ? 'Update User' : 'Create User'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
