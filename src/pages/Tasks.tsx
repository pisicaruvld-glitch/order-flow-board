import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TaskCard, priorityColor, statusBadge } from '@/components/TaskCard';
import { TaskDetailsDrawer } from '@/components/TaskDetailsDrawer';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { getTasks, Task, TaskStatus, TaskPriority } from '@/lib/tasksApi';
import { useInboxSummary } from '@/hooks/useInboxSummary';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';
import { Plus, LayoutGrid, List, Calendar, MessageSquare, AlertTriangle } from 'lucide-react';

const STATUSES: TaskStatus[] = ['OPEN', 'WAITING_REPLY', 'DONE', 'CANCELLED'];
const PRIORITIES: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export default function TasksPage() {
  const qc = useQueryClient();
  const { refresh: refreshSummary } = useInboxSummary();

  const [mine, setMine] = useState(true);
  const [waitingReply, setWaitingReply] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [textSearch, setTextSearch] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks', { mine, waitingReply }],
    queryFn: () => getTasks({ mine: mine || undefined, waiting_reply: waitingReply || undefined }),
  });

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (statusFilter !== 'ALL') list = list.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'ALL') list = list.filter(t => t.priority === priorityFilter);
    if (entityFilter) list = list.filter(t => t.entity_type?.toLowerCase().includes(entityFilter.toLowerCase()));
    if (orderSearch) list = list.filter(t => t.order_id?.includes(orderSearch));
    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tasks, statusFilter, priorityFilter, entityFilter, orderSearch, textSearch]);

  const openTask = (id: number) => { setSelectedTaskId(id); setDrawerOpen(true); };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    refreshSummary();
  };

  return (
    <PageContainer>
      <PageHeader
        title="My Tasks"
        subtitle={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant={view === 'card' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setView('card')}>
              <LayoutGrid size={14} />
            </Button>
            <Button variant={view === 'table' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setView('table')}>
              <List size={14} />
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" /> New Task
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Switch id="mine" checked={mine} onCheckedChange={setMine} />
          <Label htmlFor="mine" className="text-xs">Mine</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch id="waiting" checked={waitingReply} onCheckedChange={setWaitingReply} />
          <Label htmlFor="waiting" className="text-xs">Waiting Reply</Label>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Order ID…" className="w-[110px] h-8 text-xs" />
        <Input value={textSearch} onChange={e => setTextSearch(e.target.value)} placeholder="Search title…" className="w-[150px] h-8 text-xs" />
      </div>

      {isLoading ? <LoadingSpinner /> : error ? <ErrorMessage message="Failed to load tasks" onRetry={refreshAll} /> : filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">No tasks match your filters.</div>
      ) : view === 'card' ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />)}
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Priority</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Waiting On</TableHead>
                <TableHead className="w-24">Due</TableHead>
                <TableHead>Related</TableHead>
                <TableHead className="w-28">Updated</TableHead>
                <TableHead className="w-12">💬</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => {
                const overdue = t.due_at && !['DONE', 'CANCELLED'].includes(t.status) && isPast(parseISO(t.due_at));
                const sb = statusBadge(t.status);
                return (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50 text-xs" onClick={() => openTask(t.id)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{t.title}</TableCell>
                    <TableCell><Badge className={cn('text-[10px] px-1.5 py-0', priorityColor(t.priority))}>{t.priority}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={cn('text-[10px] px-1.5 py-0', sb.className)}>{sb.label}</Badge>
                        {overdue && <AlertTriangle size={12} className="text-[hsl(var(--destructive))]" />}
                      </div>
                    </TableCell>
                    <TableCell>{t.assigned_to_username ?? '—'}</TableCell>
                    <TableCell>{t.waiting_on_username ?? '—'}</TableCell>
                    <TableCell className={cn(overdue && 'text-[hsl(var(--destructive))] font-medium')}>
                      {t.due_at ? format(parseISO(t.due_at), 'dd MMM') : '—'}
                    </TableCell>
                    <TableCell>
                      {t.entity_type ? <span className="bg-muted px-1 py-0.5 rounded text-[10px]">{t.entity_type}{t.order_id ? `#${t.order_id}` : ''}</span> : '—'}
                    </TableCell>
                    <TableCell>{format(parseISO(t.updated_at), 'dd MMM HH:mm')}</TableCell>
                    <TableCell className="text-center">{t.comment_count ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailsDrawer taskId={selectedTaskId} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdated={refreshAll} />
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => openTask(id)} />
    </PageContainer>
  );
}
