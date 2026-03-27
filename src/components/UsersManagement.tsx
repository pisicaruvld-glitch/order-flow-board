import { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUser, deleteUser, OperationalUser, UserArea, CreateUserPayload, UpdateUserPayload } from '@/lib/usersApi';
import { adminResetPassword } from '@/lib/authApi';
import { useAuth } from '@/lib/AuthContext';
import { LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users, Loader2, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALL_AREAS: UserArea[] = ['Orders', 'Warehouse', 'Production', 'Logistics'];

export default function UsersManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OperationalUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<OperationalUser | null>(null);
  const [resetPwUser, setResetPwUser] = useState<OperationalUser | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);

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
        await updateUser(editingUser.id, data as UpdateUserPayload);
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

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteUser(deletingUser.id);
      toast.success('User deleted successfully');
      setDeletingUser(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || !resetPwValue.trim()) return;
    setResetPwLoading(true);
    try {
      await adminResetPassword(resetPwUser.id, { new_password: resetPwValue.trim() });
      toast.success(`Password reset for ${resetPwUser.username}`);
      setResetPwUser(null);
      setResetPwValue('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setResetPwLoading(false);
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
        {isAdmin && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={openAdd}>
            <Plus size={12} /> Add User
          </Button>
        )}
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
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
                <th className="text-left px-4 py-2.5 font-medium">Areas</th>
                <th className="text-left px-4 py-2.5 font-medium">Active</th>
                <th className="text-left px-4 py-2.5 font-medium">Last Login</th>
                <th className="text-left px-4 py-2.5 font-medium">Reset Req.</th>
                {isAdmin && <th className="text-left px-4 py-2.5 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-8 text-xs">No users found</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className={cn('border-b border-border hover:bg-muted/40', !u.is_active && 'opacity-50')}>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{u.id}</td>
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      (u as any).role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {(u as any).role ?? 'basic'}
                    </span>
                  </td>
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
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {(u as any).last_login_at ? new Date((u as any).last_login_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {(u as any).reset_required ? (
                      <span className="text-warning font-medium">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openEdit(u)}>
                          <Pencil size={12} /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setResetPwUser(u); setResetPwValue(''); }}>
                          <KeyRound size={12} /> Reset PW
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeletingUser(u)}
                          disabled={u.username === 'admin'}
                          title={u.username === 'admin' ? 'Cannot delete admin user' : 'Delete user'}
                        >
                          <Trash2 size={12} /> Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <UserForm
            initial={editingUser}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
            showRoleField={isAdmin}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={open => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user <strong>{deletingUser?.username}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwUser} onOpenChange={open => { if (!open) { setResetPwUser(null); setResetPwValue(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={16} />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a new password for <strong>{resetPwUser?.username}</strong>.
          </p>
          <div>
            <label className="text-xs font-medium text-muted-foreground">New Password</label>
            <Input
              type="password"
              value={resetPwValue}
              onChange={e => setResetPwValue(e.target.value)}
              placeholder="Enter new password"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleResetPassword} className="flex-1 gap-1.5" disabled={resetPwLoading || !resetPwValue.trim()}>
              {resetPwLoading && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </Button>
            <Button variant="outline" onClick={() => { setResetPwUser(null); setResetPwValue(''); }}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({
  initial,
  onSave,
  onCancel,
  showRoleField,
}: {
  initial: OperationalUser | null;
  onSave: (data: CreateUserPayload) => Promise<void>;
  onCancel: () => void;
  showRoleField: boolean;
}) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password_text ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? 1);
  const [areas, setAreas] = useState<UserArea[]>(initial?.areas ?? []);
  const [role, setRole] = useState<string>((initial as any)?.role ?? 'basic');
  const [saving, setSaving] = useState(false);

  const toggleArea = (area: UserArea) => {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      const payload: any = { username: username.trim(), password_text: password, is_active: isActive, areas };
      if (showRoleField) payload.role = role;
      await onSave(payload);
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
        <Input value={password} onChange={e => setPassword(e.target.value)} placeholder={initial ? 'Leave empty to keep' : 'Password'} className="mt-1" />
      </div>
      {showRoleField && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <div className="flex gap-2 mt-1.5">
            {['basic', 'admin'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded border transition-colors capitalize',
                  role === r
                    ? r === 'admin' ? 'bg-primary/15 text-primary border-primary/40' : 'bg-secondary text-secondary-foreground border-border'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
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
