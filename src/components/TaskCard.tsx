import { Task, TaskPriority, TaskStatus } from '@/lib/tasksApi';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, MessageSquare, User, AlertTriangle, Clock } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

export function priorityColor(p: TaskPriority): string {
  switch (p) {
    case 'CRITICAL': return 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]';
    case 'HIGH': return 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]';
    case 'NORMAL': return 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]';
    case 'LOW': return 'bg-muted text-muted-foreground';
  }
}

export function statusBadge(s: TaskStatus): { className: string; label: string } {
  switch (s) {
    case 'OPEN': return { className: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]', label: 'Open' };
    case 'WAITING_REPLY': return { className: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] animate-pulse', label: 'Waiting Reply' };
    case 'DONE': return { className: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]', label: 'Done' };
    case 'CANCELLED': return { className: 'bg-muted text-muted-foreground opacity-60', label: 'Cancelled' };
  }
}

function isOverdue(task: Task): boolean {
  if (!task.due_at) return false;
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
  return isPast(parseISO(task.due_at));
}

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, onClick, compact }: TaskCardProps) {
  const overdue = isOverdue(task);
  const sBadge = statusBadge(task.status);
  const pBadge = priorityColor(task.priority);

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-card p-3 cursor-pointer transition-all hover:shadow-elevated',
        task.status === 'WAITING_REPLY' && 'border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/5',
        task.status === 'DONE' && 'opacity-70',
        overdue && 'border-[hsl(var(--destructive))]/50',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className={cn('text-sm font-medium leading-tight line-clamp-2', compact && 'text-xs')}>
          {task.title}
        </h3>
        <Badge className={cn('shrink-0 text-[10px] px-1.5 py-0', pBadge)}>{task.priority}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge className={cn('text-[10px] px-1.5 py-0', sBadge.className)}>{sBadge.label}</Badge>
        {overdue && (
          <Badge className="text-[10px] px-1.5 py-0 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">
            <AlertTriangle size={10} className="mr-0.5" /> Overdue
          </Badge>
        )}
        {task.entity_type && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {task.entity_type}{task.entity_id ? `:${task.entity_id}` : ''}{task.order_id ? ` #${task.order_id}` : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {task.assigned_to_username && (
          <span className="flex items-center gap-0.5"><User size={10} /> {task.assigned_to_username}</span>
        )}
        {task.due_at && (
          <span className={cn('flex items-center gap-0.5', overdue && 'text-[hsl(var(--destructive))] font-medium')}>
            <Calendar size={10} /> {format(parseISO(task.due_at), 'dd MMM')}
          </span>
        )}
        {(task.comment_count ?? 0) > 0 && (
          <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {task.comment_count}</span>
        )}
        <span className="flex items-center gap-0.5 ml-auto">
          <Clock size={10} /> {format(parseISO(task.updated_at), 'dd MMM HH:mm')}
        </span>
      </div>
    </div>
  );
}
