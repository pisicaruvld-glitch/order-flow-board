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
import { Bell, CheckCircle, ExternalLink, Plus } from 'lucide-react';

export default function InboxPage() {
  const { summary, refresh: refreshSummary } = useInboxSummary();
  const qc = useQueryClient();

  const [tab, setTab] = useState('open');
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
    queryKey: ['notifications', 'unread'],
    queryFn: () => getNotifications(true),
  });

  const openTask = (id: number) => { setSelectedTaskId(id); setDrawerOpen(true); };

  const handleMarkRead = async (id: number) => {
    await markNotificationRead(id);
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
  const unreadNotifs = notifications ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Inbox"
        subtitle="Your tasks, replies needed, and notifications"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" /> New Task
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="open" className="gap-1.5">
            My Open Tasks
            {summary.my_open_tasks > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]">{summary.my_open_tasks}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="gap-1.5">
            Waiting My Reply
            {summary.waiting_my_reply > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">{summary.waiting_my_reply}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            Notifications
            {summary.unread_notifications > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">{summary.unread_notifications}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
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
            unreadNotifs.length === 0 ? <EmptyState text="No unread notifications." /> : (
              <div className="space-y-2">
                {unreadNotifs.map(n => (
                  <NotificationCard key={n.id} notification={n} onMarkRead={() => handleMarkRead(n.id)} onOpenTask={n.task_id ? () => openTask(n.task_id!) : undefined} />
                ))}
              </div>
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

function NotificationCard({ notification: n, onMarkRead, onOpenTask }: { notification: Notification; onMarkRead: () => void; onOpenTask?: () => void }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-card p-3', !n.is_read && 'border-[hsl(var(--info))]/40 bg-[hsl(var(--info))]/5')}>
      <Bell size={16} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{format(parseISO(n.created_at), 'dd MMM HH:mm')}</span>
          {n.type && <Badge variant="outline" className="text-[10px] px-1 py-0">{n.type}</Badge>}
          {n.entity_type && <span className="bg-muted px-1.5 py-0.5 rounded">{n.entity_type}{n.entity_id ? `:${n.entity_id}` : ''}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onOpenTask && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenTask} title="Open task">
            <ExternalLink size={12} />
          </Button>
        )}
        {!n.is_read && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMarkRead} title="Mark read">
            <CheckCircle size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}
