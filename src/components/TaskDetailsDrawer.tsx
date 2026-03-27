import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Task, TaskComment, TaskStatus, TaskPriority,
  getTask, getTaskComments, updateTask, addTaskComment,
} from '@/lib/tasksApi';
import { priorityColor, statusBadge } from './TaskCard';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';
import { Calendar, User, Clock, Send, AlertTriangle, MessageSquare } from 'lucide-react';

const STATUSES: TaskStatus[] = ['OPEN', 'WAITING_REPLY', 'DONE', 'CANCELLED'];
const PRIORITIES: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

interface Props {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function TaskDetailsDrawer({ taskId, open, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: task, isLoading: loadingTask } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId && open,
  });

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => getTaskComments(taskId!),
    enabled: !!taskId && open,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
    qc.invalidateQueries({ queryKey: ['inbox-summary'] });
    onUpdated?.();
  };

  const handleUpdate = async (payload: Partial<Task>) => {
    if (!taskId) return;
    try {
      await updateTask(taskId, payload);
      toast({ title: 'Task updated' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleComment = async () => {
    if (!taskId || !comment.trim()) return;
    setSubmitting(true);
    try {
      await addTaskComment(taskId, comment.trim());
      setComment('');
      toast({ title: 'Comment added' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const overdue = task?.due_at && !['DONE', 'CANCELLED'].includes(task.status) && isPast(parseISO(task.due_at));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="text-base">Task Details</SheetTitle>
        </SheetHeader>

        {loadingTask ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : !task ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Task not found</div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Title */}
              <h2 className="text-lg font-semibold leading-tight">{task.title}</h2>

              {/* Status + Priority row */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={task.status} onValueChange={(v) => handleUpdate({ status: v as TaskStatus })}>
                  <SelectTrigger className="w-auto h-7 text-xs gap-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0', statusBadge(task.status).className)}>
                      {statusBadge(task.status).label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={task.priority} onValueChange={(v) => handleUpdate({ priority: v as TaskPriority })}>
                  <SelectTrigger className="w-auto h-7 text-xs gap-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0', priorityColor(task.priority))}>{task.priority}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>

                {overdue && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">
                    <AlertTriangle size={10} className="mr-0.5" /> Overdue
                  </Badge>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              )}

              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Field label="Assigned To" value={task.assigned_to_username} />
                <Field label="Waiting On" value={task.waiting_on_username} />
                <Field label="Created By" value={task.created_by_username} />
                <Field label="Due Date" value={task.due_at ? format(parseISO(task.due_at), 'dd MMM yyyy') : undefined} />
                <Field label="Entity" value={task.entity_type ? `${task.entity_type}${task.entity_id ? `:${task.entity_id}` : ''}` : undefined} />
                <Field label="Order" value={task.order_id} />
                <Field label="Created" value={format(parseISO(task.created_at), 'dd MMM yyyy HH:mm')} />
                <Field label="Updated" value={format(parseISO(task.updated_at), 'dd MMM yyyy HH:mm')} />
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                {task.status !== 'DONE' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleUpdate({ status: 'DONE' })}>
                    Mark Done
                  </Button>
                )}
                {task.status === 'DONE' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleUpdate({ status: 'OPEN' })}>
                    Reopen
                  </Button>
                )}
              </div>

              <Separator />

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <MessageSquare size={14} /> Comments ({comments?.length ?? 0})
                </h3>
                <div className="space-y-2 mb-3">
                  {loadingComments ? (
                    <p className="text-xs text-muted-foreground">Loading comments…</p>
                  ) : !comments?.length ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="bg-muted rounded p-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{c.username ?? 'User'}</span>
                          <span className="text-[10px] text-muted-foreground">{format(parseISO(c.created_at), 'dd MMM HH:mm')}</span>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{c.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a comment…"
                    className="text-xs min-h-[60px]"
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleComment(); }}
                  />
                  <Button size="icon" className="shrink-0 h-[60px] w-9" disabled={!comment.trim() || submitting} onClick={handleComment}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
