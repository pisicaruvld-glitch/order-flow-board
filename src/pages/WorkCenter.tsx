import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailsDrawer } from '@/components/TaskDetailsDrawer';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import {
  getWorkCenter, getTasks, markNotificationRead, markAllNotificationsRead,
  Task, Notification,
} from '@/lib/tasksApi';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';
import {
  Bell, CheckCircle, ExternalLink, Plus, ClipboardList, Clock, BellRing,
  UserPlus, AlertTriangle, CheckCheck,
} from 'lucide-react';

type TabValue = 'my-tasks' | 'waiting' | 'notifications' | 'created' | 'overdue';

export default function WorkCenterPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabValue>('my-tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Aggregated load
  const { data: wc, isLoading, error, refetch: refetchWC } = useQuery({
    queryKey: ['work-center'],
    queryFn: getWorkCenter,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // Created by me - separate fetch since not in aggregate
  const { data: createdTasks, isLoading: loadCreated } = useQuery({
    queryKey: ['tasks', 'created-by-me'],
    queryFn: () => getTasks({}),
    enabled: !!user,
  });

  const summary = wc?.summary ?? { my_open_tasks: 0, waiting_my_reply: 0, unread_notifications: 0, open_created_by_me: 0 };
  const myTasks = (wc?.my_tasks ?? []).filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const waitingList = (wc?.waiting_reply ?? []).filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const allNotifs = wc?.notifications ?? [];
  const unreadNotifs = allNotifs.filter(n => !n.is_read);

  // Overdue: from myTasks + waitingList, deduped
  const overdueTasks = (() => {
    const seen = new Set<number>();
    const result: Task[] = [];
    for (const t of [...myTasks, ...waitingList]) {
      if (!seen.has(t.id) && t.due_at && isPast(parseISO(t.due_at))) {
        seen.add(t.id);
        result.push(t);
      }
    }
    return result;
  })();

  // Created by me filtered
  const createdByMe = (createdTasks ?? []).filter(t => t.created_by_user_id === user?.id);

  const refreshAll = useCallback(() => {
    refetchWC();
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task'] });
    qc.invalidateQueries({ queryKey: ['task-comments'] });
    qc.invalidateQueries({ queryKey: ['task-history'] });
    qc.invalidateQueries({ queryKey: ['inbox-summary'] });
  }, [refetchWC, qc]);

  const openTask = (id: number | undefined) => {
    if (!id) { console.warn('Cannot open task: missing id'); return; }
    setSelectedTaskId(id);
    setDrawerOpen(true);
  };

  const handleMarkRead = async (n: Notification) => {
    if (!n.id) { console.error('Notification missing id, skipping mark-read', n); return; }
    await markNotificationRead(n.id);
    refreshAll();
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      refreshAll();
    } finally {
      setMarkingAll(false);
    }
  };

  const kpis = [
    { key: 'my-tasks' as TabValue, label: 'My Open Tasks', count: summary.my_open_tasks, icon: ClipboardList, color: 'bg-[hsl(var(--info))]/10 border-[hsl(var(--info))]/30 text-[hsl(var(--info))]' },
    { key: 'waiting' as TabValue, label: 'Waiting My Reply', count: summary.waiting_my_reply, icon: Clock, color: 'bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]' },
    { key: 'notifications' as TabValue, label: 'Unread Notifications', count: summary.unread_notifications, icon: BellRing, color: 'bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))]' },
    { key: 'created' as TabValue, label: 'Created by Me', count: summary.open_created_by_me ?? createdByMe.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length, icon: UserPlus, color: 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))]' },
  ];

  if (isLoading) return <PageContainer><LoadingSpinner /></PageContainer>;
  if (error) return <PageContainer><ErrorMessage message="Failed to load Work Center" onRetry={() => refetchWC()} /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Work Center"
        subtitle="Tasks, replies, and notifications in one place"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" /> New Task
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {kpis.map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
              tab === key ? color : 'bg-card border-border hover:border-muted-foreground/30'
            )}
          >
            <Icon size={20} className={tab === key ? '' : 'text-muted-foreground'} />
            <div>
              <div className={cn('text-2xl font-bold', tab !== key && 'text-foreground')}>{count}</div>
              <div className={cn('text-xs', tab !== key && 'text-muted-foreground')}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="mb-4">
          <TabsTrigger value="my-tasks" className="gap-1.5">
            My Tasks
            {summary.my_open_tasks > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]">{summary.my_open_tasks}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="gap-1.5">
            Waiting Reply
            {summary.waiting_my_reply > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">{summary.waiting_my_reply}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            Notifications
            {summary.unread_notifications > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">{summary.unread_notifications}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="created" className="gap-1.5">Created by Me</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            Overdue
            {overdueTasks.length > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">{overdueTasks.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks">
          <TaskGrid tasks={myTasks} onOpen={openTask} emptyText="No open tasks assigned to you." />
        </TabsContent>

        <TabsContent value="waiting">
          <TaskGrid tasks={waitingList} onOpen={openTask} emptyText="No tasks waiting on your reply." />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-2">
            {unreadNotifs.length > 0 && (
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleMarkAllRead} disabled={markingAll}>
                  <CheckCheck size={12} /> Mark all as read
                </Button>
              </div>
            )}
            {allNotifs.length === 0 ? <EmptyState text="No notifications." /> : (
              allNotifs.map(n => (
                <NotificationCard
                  key={n.id ?? `notif-${n.created_at}`}
                  notification={n}
                  onMarkRead={n.id ? () => handleMarkRead(n) : undefined}
                  onOpenTask={n.task_id ? () => openTask(n.task_id!) : undefined}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="created">
          {loadCreated ? <LoadingSpinner /> : (
            <TaskGrid tasks={createdByMe} onOpen={openTask} emptyText="No tasks created by you." />
          )}
        </TabsContent>

        <TabsContent value="overdue">
          <TaskGrid tasks={overdueTasks} onOpen={openTask} emptyText="No overdue tasks." />
        </TabsContent>
      </Tabs>

      <TaskDetailsDrawer taskId={selectedTaskId} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdated={refreshAll} />
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => { refreshAll(); openTask(id); }} />
    </PageContainer>
  );
}

function TaskGrid({ tasks, onOpen, emptyText }: { tasks: Task[]; onOpen: (id: number) => void; emptyText: string }) {
  if (tasks.length === 0) return <EmptyState text={emptyText} />;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onOpen(t.id)} />)}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-sm text-muted-foreground py-12">{text}</div>;
}

function NotificationCard({ notification: n, onMarkRead, onOpenTask }: { notification: Notification; onMarkRead?: () => void; onOpenTask?: () => void }) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors',
      !n.is_read && 'border-[hsl(var(--info))]/40 bg-[hsl(var(--info))]/5',
      n.is_read && 'opacity-60',
    )}>
      <Bell size={16} className={cn('mt-0.5 shrink-0', n.is_read ? 'text-muted-foreground' : 'text-[hsl(var(--info))]')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', !n.is_read && 'font-medium')}>{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{format(parseISO(n.created_at), 'dd MMM HH:mm')}</span>
          {n.type && <Badge variant="outline" className="text-[10px] px-1 py-0">{n.type}</Badge>}
          {n.entity_type && <span className="bg-muted px-1.5 py-0.5 rounded">{n.entity_type}{n.entity_id ? `:${n.entity_id}` : ''}</span>}
          {!n.is_read && <Badge className="text-[10px] px-1 py-0 bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]">Unread</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onOpenTask && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenTask} title="Open task">
            <ExternalLink size={12} />
          </Button>
        )}
        {onMarkRead && !n.is_read && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMarkRead} title="Mark read">
            <CheckCircle size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}
