import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNotifications, markNotificationRead, Notification } from '@/lib/tasksApi';
import { TaskDetailsDrawer } from '@/components/TaskDetailsDrawer';
import { useInboxSummary } from '@/hooks/useInboxSummary';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Bell, CheckCircle, ExternalLink } from 'lucide-react';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { refresh: refreshSummary } = useInboxSummary();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: notifications, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => getNotifications(false),
  });

  const handleMarkRead = async (id: number) => {
    await markNotificationRead(id);
    refetch();
    refreshSummary();
  };

  const openTask = (id: number) => { setSelectedTaskId(id); setDrawerOpen(true); };

  return (
    <PageContainer>
      <PageHeader title="Notifications" subtitle={`${notifications?.length ?? 0} total`} />

      {isLoading ? <LoadingSpinner /> : error ? <ErrorMessage message="Failed to load notifications" onRetry={() => refetch()} /> : (
        (notifications ?? []).length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">No notifications.</div>
        ) : (
          <div className="space-y-2">
            {(notifications ?? []).map(n => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors',
                  !n.is_read && 'border-[hsl(var(--info))]/40 bg-[hsl(var(--info))]/5',
                  n.is_read && 'opacity-60',
                )}
              >
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
                  {n.task_id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTask(n.task_id!)} title="Open task">
                      <ExternalLink size={12} />
                    </Button>
                  )}
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkRead(n.id)} title="Mark read">
                      <CheckCircle size={12} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <TaskDetailsDrawer taskId={selectedTaskId} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdated={() => { refetch(); refreshSummary(); }} />
    </PageContainer>
  );
}
