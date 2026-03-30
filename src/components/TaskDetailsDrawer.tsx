import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Task, TaskComment, TaskStatus, TaskPriority, TaskHistoryEntry,
  getTask, getTaskComments, getTaskHistory, updateTask, addTaskComment,
} from '@/lib/tasksApi';
import { priorityColor, statusBadge } from './TaskCard';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';
import {
  Calendar, User, Clock, Send, AlertTriangle, MessageSquare,
  History, FileText, ArrowRight,
} from 'lucide-react';

const STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_REPLY', 'DONE', 'CANCELLED'];
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
  const [drawerTab, setDrawerTab] = useState<'details' | 'comments' | 'history'>('details');

  const validId = typeof taskId === 'number' && taskId > 0;

  const { data: task, isLoading: loadingTask } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: validId && open,
  });

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => getTaskComments(taskId!),
    enabled: validId && open,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['task-history', taskId],
    queryFn: () => getTaskHistory(taskId!),
    enabled: validId && open && drawerTab === 'history',
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
    qc.invalidateQueries({ queryKey: ['task-history', taskId] });
    qc.invalidateQueries({ queryKey: ['work-center'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['inbox-summary'] });
    onUpdated?.();
  };

  const handleUpdate = async (payload: Partial<Task>) => {
    if (!validId) { console.warn('Cannot update task: missing id'); return; }
    try {
      await updateTask(taskId!, payload);
      toast({ title: 'Task updated' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleComment = async () => {
    if (!validId) { console.warn('Cannot add comment: missing task id'); return; }
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await addTaskComment(taskId!, comment.trim());
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
  const isClosed = task?.status === 'DONE' || task?.status === 'CANCELLED';

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
          <>
            {/* Title + Status row always visible */}
            <div className="px-4 pb-2">
              <h2 className="text-lg font-semibold leading-tight mb-2">{task.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={task.status} onValueChange={(v) => handleUpdate({ status: v as TaskStatus })}>
                  <SelectTrigger className="w-auto h-7 text-xs gap-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0', statusBadge(task.status).className)}>
                      {statusBadge(task.status).label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
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

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 mt-2">
                {!isClosed && task.status !== 'IN_PROGRESS' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleUpdate({ status: 'IN_PROGRESS' })}>
                    Start Working
                  </Button>
                )}
                {!isClosed && (
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
            </div>

            <Separator />

            {/* Drawer tabs */}
            <Tabs value={drawerTab} onValueChange={v => setDrawerTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-4 mt-2 mb-0">
                <TabsTrigger value="details" className="gap-1 text-xs"><FileText size={12} /> Details</TabsTrigger>
                <TabsTrigger value="comments" className="gap-1 text-xs">
                  <MessageSquare size={12} /> Comments
                  {(comments?.length ?? 0) > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{comments?.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1 text-xs"><History size={12} /> History</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="details" className="px-4 pb-4 mt-2">
                  {task.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{task.description}</p>
                  )}
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
                </TabsContent>

                <TabsContent value="comments" className="px-4 pb-4 mt-2">
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
                  {!isClosed && (
                    <div className="flex gap-2">
                      <Textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Add a comment…"
                        className="text-xs min-h-[60px]"
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleComment(); }}
                        disabled={!validId}
                      />
                      <Button size="icon" className="shrink-0 h-[60px] w-9" disabled={!comment.trim() || submitting || !validId} onClick={handleComment}>
                        <Send size={14} />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="px-4 pb-4 mt-2">
                  {loadingHistory ? (
                    <p className="text-xs text-muted-foreground">Loading history…</p>
                  ) : !history?.length ? (
                    <p className="text-xs text-muted-foreground">No history entries.</p>
                  ) : (
                    <div className="relative pl-4 border-l-2 border-muted space-y-3">
                      {history.map(h => (
                        <div key={h.id} className="relative">
                          <div className="absolute -left-[calc(1rem+5px)] top-1.5 w-2 h-2 rounded-full bg-primary" />
                          <div className="text-xs">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium">{h.action}</span>
                              <span className="text-muted-foreground">{format(parseISO(h.changed_at), 'dd MMM HH:mm')}</span>
                            </div>
                            {h.changed_by_username && (
                              <p className="text-muted-foreground">by {h.changed_by_username}</p>
                            )}
                            {h.details && (
                              <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{h.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
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
