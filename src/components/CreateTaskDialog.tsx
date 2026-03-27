import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createTask, TaskPriority, TaskStatus } from '@/lib/tasksApi';
import { getUsers, OperationalUser } from '@/lib/usersApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (taskId: number) => void;
  /** Pre-fill fields for order integration */
  defaults?: {
    entity_type?: string;
    entity_id?: string;
    order_id?: string;
    title?: string;
  };
}

export function CreateTaskDialog({ open, onOpenChange, onCreated, defaults }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [title, setTitle] = useState(defaults?.title ?? '');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [entityType, setEntityType] = useState(defaults?.entity_type ?? '');
  const [entityId, setEntityId] = useState(defaults?.entity_id ?? '');
  const [orderId, setOrderId] = useState(defaults?.order_id ?? '');
  const [submitting, setSubmitting] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });

  const reset = () => {
    setTitle(defaults?.title ?? '');
    setDescription('');
    setAssignedTo('');
    setWaitingOn('');
    setPriority('NORMAL');
    setDueAt('');
    setEntityType(defaults?.entity_type ?? '');
    setEntityId(defaults?.entity_id ?? '');
    setOrderId(defaults?.order_id ?? '');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !assignedTo) {
      toast({ title: 'Missing fields', description: 'Title and Assigned To are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_to_user_id: Number(assignedTo),
        waiting_on_user_id: waitingOn ? Number(waitingOn) : undefined,
        priority,
        due_at: dueAt || undefined,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        order_id: orderId || undefined,
      });
      toast({ title: 'Task created' });
      qc.invalidateQueries({ queryKey: ['inbox-summary'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      reset();
      onOpenChange(false);
      onCreated?.(task.id);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Details…" className="text-xs min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Assigned To *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {(users ?? []).filter(u => u.is_active !== 0).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Waiting On</Label>
              <Select value={waitingOn} onValueChange={setWaitingOn}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {(users ?? []).filter(u => u.is_active !== 0).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Entity Type</Label>
              <Input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="e.g. order" className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">Entity ID</Label>
              <Input value={entityId} onChange={e => setEntityId(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">Order ID</Label>
              <Input value={orderId} onChange={e => setOrderId(e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
