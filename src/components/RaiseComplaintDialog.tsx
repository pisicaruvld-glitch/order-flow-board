import { useState, useEffect } from 'react';
import { getUsersByArea, OperationalUser } from '@/lib/usersApi';
import { createComplaint, COMPLAINT_TYPES, COMPLAINT_SEVERITIES, ComplaintType, ComplaintSeverity } from '@/lib/complaintsApi';
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

export function RaiseComplaintDialog({ orderId, open, onOpenChange, onSuccess }: Props) {
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [complaintType, setComplaintType] = useState<ComplaintType>('MISSING_COMPONENTS');
  const [severity, setSeverity] = useState<ComplaintSeverity>('MEDIUM');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingUsers(true);
    getUsersByArea('Production')
      .then(setUsers)
      .catch(() => toast.error('Failed to load production users'))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedUserId || !comment.trim()) return;
    setSaving(true);
    try {
      await createComplaint(orderId, {
        raised_by_user_id: selectedUserId as number,
        complaint_type: complaintType,
        severity,
        comment: comment.trim(),
      });
      toast.success('Complaint raised successfully');
      onOpenChange(false);
      setComment('');
      setSelectedUserId('');
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to raise complaint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise Complaint — Order {orderId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Raised by *</label>
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
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Complaint Type *</label>
              <select
                value={complaintType}
                onChange={e => setComplaintType(e.target.value as ComplaintType)}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {COMPLAINT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity *</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as ComplaintSeverity)}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {COMPLAINT_SEVERITIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comment *</label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe the issue…"
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={saving || !selectedUserId || !comment.trim()}
              className="flex-1 gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Raise Complaint
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
