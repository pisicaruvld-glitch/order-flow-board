import { useState, useEffect } from 'react';
import { getUsersByArea, OperationalUser } from '@/lib/usersApi';
import { warehousePrepare } from '@/lib/complaintsApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WarehousePrepareDialog({ orderId, open, onOpenChange, onSuccess }: Props) {
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingUsers(true);
    getUsersByArea('Warehouse')
      .then(setUsers)
      .catch(() => toast.error('Failed to load warehouse users'))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await warehousePrepare(orderId, {
        prepared_by_user_id: selectedUserId as number,
        comment: comment.trim() || undefined,
      });
      toast.success('Order prepared successfully');
      onOpenChange(false);
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to prepare order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prepare Order {orderId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Prepared by *</label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> Loading users…
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select user…</option>
                {users.filter(u => u.is_active).map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.username}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comment (optional)</label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="e.g. Kit ready"
              className="mt-1 min-h-[60px] text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={saving || !selectedUserId} className="flex-1 gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Confirm Preparation
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
