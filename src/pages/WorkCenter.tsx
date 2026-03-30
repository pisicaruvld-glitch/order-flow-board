import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailsDrawer } from '@/components/TaskDetailsDrawer';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import {
  getTasks, getNotifications, markNotificationRead,
  Task, Notification,
} from '@/lib/tasksApi';
import { useInboxSummary } from '@/hooks/useInboxSummary';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Bell, CheckCircle, ExternalLink, Plus, ClipboardList, Clock, BellRing } from 'lucide-react';

type TabValue = 'my-tasks' | 'waiting' | 'notifications' | 'created';

export default function WorkCenterPage() {
  const { summary, refresh: refreshSummary } = useInboxSummary();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabValue>('my-tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: myTasks, isLoading: loadMyTasks, error: errMyTasks } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: () => getTasks({ mine: true }),
  });
  const { data: waitingTasks, isLoading: loadWaiting, error: errWaiting } = useQuery({
    queryKey: ['tasks', 'waiting'],
    queryFn: () => getTasks({ waiting_reply: true }),
  });
  const { data: notifications, isLoading: loadNotifs, error: errNotifs, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => getNotifications(false),
  });
  const { data: createdTasks, isLoading: loadCreated, error: errCreated } = useQuery({
    queryKey: ['tasks', 'created-by-me'],
    queryFn: () => getTasks({}),
  });

  const openTask = (id: number) => { setSelectedTaskId(id); setDrawerOpen(true); };

  const handleMarkRead = async (n: Notification) => {
    const nid = (n as any).notification_id ?? n.id;
    if (!nid) {
      console.error('Notification missing notification_id, skipping mark-read', n);
      return;
    }
    await markNotificationRead(nid);
    refetchNotifs();
    refreshSummary();
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    refetchNotifs();
    refreshSummary();
  };

  const openTasks = (myTasks ?? []).filter(t => t.status === 'OPEN' || t.status === 'WAITING_REPLY');
  const waitingList = waitingTasks ?? [];
  const allNotifs = notifications ?? [];
  const unreadNotifs = allNotifs.filter(n => !n.is_read);

  // KPI cards data
  const kpis = [
    { key: 'my-tasks' as TabValue, label: 'My Open Tasks', count: summary.my_open_tasks, icon: ClipboardList, color: 'bg-[hsl(var(--info))]/10 border-[hsl(var(--info))]/30 text-[hsl(var(--info))]' },
    { key: 'waiting' as TabValue, label: 'Waiting My Reply', count: summary.waiting_my_reply, icon: Clock, color: 'bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]' },
    { key: 'notifications' as TabValue, label: 'Unread Notifications', count: summary.unread_notifications, icon: BellRing, color: 'bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))]' },
  ];

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
      <div className="grid grid-cols-3 gap-3 mb-5">
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
          <TabsTrigger value="created" className="gap-1.5">
            Created by Me
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks">
          {loadMyTasks ? <LoadingSpinner /> : errMyTasks ? <ErrorMessage message="Failed to load tasks" onRetry={() => qc.invalidateQueries({ queryKey: ['tasks', 'mine'] })} /> : (
            openTasks.length === 0 ? <EmptyState text="No open tasks assigned to you." /> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{openTasks.map(t => <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />)}</div>
            )
          )}
        </TabsContent>

        <TabsContent value="waiting">
          {loadWaiting ? <LoadingSpinner /> : errWaiting ? <ErrorMessage message="Failed to load tasks" /> : (
            waitingList.length === 0 ? <EmptyState text="No tasks waiting on your reply." /> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{waitingList.map(t => <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />)}</div>
            )
          )}
        </TabsContent>

        <TabsContent value="notifications">
          {loadNotifs ? <LoadingSpinner /> : errNotifs ? <ErrorMessage message="Failed to load notifications" /> : (
            allNotifs.length === 0 ? <EmptyState text="No notifications." /> : (
              <div className="space-y-2">
                {allNotifs.map(n => {
                  const nid = (n as any).notification_id ?? n.id;
                  return (
                    <NotificationCard
                      key={nid ?? `notif-${n.created_at}`}
                      notification={n}
                      onMarkRead={nid ? () => handleMarkRead(n) : undefined}
                      onOpenTask={n.task_id ? () => openTask(n.task_id!) : undefined}
                    />
                  );
                })}
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="created">
          {loadCreated ? <LoadingSpinner /> : errCreated ? <ErrorMessage message="Failed to load tasks" /> : (
            (createdTasks ?? []).length === 0 ? <EmptyState text="No tasks created by you." /> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(createdTasks ?? []).map(t => <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />)}</div>
            )
          )}
        </TabsContent>
      </Tabs>

      <TaskDetailsDrawer taskId={selectedTaskId} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdated={refreshAll} />
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => openTask(id)} />
    </PageContainer>
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
