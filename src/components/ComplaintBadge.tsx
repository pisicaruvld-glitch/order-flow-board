import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ComplaintBadgeProps {
  count?: number;
  severity?: string;
  className?: string;
}

const severityStyles: Record<string, string> = {
  HIGH: 'bg-destructive/15 text-destructive border-destructive/30',
  MEDIUM: 'bg-warning/15 text-warning border-warning/30',
  LOW: 'bg-[hsl(48_96%_53%)]/15 text-[hsl(48_96%_35%)] border-[hsl(48_96%_53%)]/30',
};

export function ComplaintBadge({ count = 1, severity, className }: ComplaintBadgeProps) {
  if (count <= 0) return null;
  const style = severityStyles[severity ?? 'MEDIUM'] ?? severityStyles.MEDIUM;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded border leading-none shrink-0',
        style,
        className,
      )}
      title={`${count} open complaint(s) — severity: ${severity ?? 'unknown'}`}
    >
      <AlertTriangle size={8} />
      {count > 1 ? `COMPLAINT (${count})` : 'COMPLAINT'}
    </span>
  );
}
