import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OrderIssueIndicatorProps {
  count: number;
  /** Larger size for TV view */
  tv?: boolean;
}

export function OrderIssueIndicator({ count, tv }: OrderIssueIndicatorProps) {
  if (count <= 0) return null;

  const icon = (
    <div
      className={cn(
        'absolute top-1 right-1 z-10 flex items-center justify-center rounded-full bg-warning text-warning-foreground shadow-md',
        tv ? 'w-7 h-7' : 'w-5 h-5'
      )}
      title={tv ? `Open issues: ${count}` : undefined}
    >
      <AlertTriangle size={tv ? 16 : 12} strokeWidth={2.5} />
    </div>
  );

  if (tv) return icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{icon}</TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          Open issues: {count}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
