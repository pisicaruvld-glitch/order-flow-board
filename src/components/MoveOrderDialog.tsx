import { useState } from 'react';
import { Area } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeft, AlertTriangle, X } from 'lucide-react';

interface MoveOrderDialogProps {
  orderId: string;
  currentArea: Area;
  targetArea: Area;
  isNextStep: boolean; // true = next step, false = move back
  blockedReason?: string; // if set, show blocking message
  onConfirm: (justification?: string) => Promise<void>;
  onCancel: () => void;
}

export function MoveOrderDialog({
  orderId,
  currentArea,
  targetArea,
  isNextStep,
  blockedReason,
  onConfirm,
  onCancel,
}: MoveOrderDialogProps) {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requiresJustification = !isNextStep; // move back always requires justification

  const canConfirm = blockedReason
    ? false
    : !requiresJustification || justification.trim().length >= 5;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(requiresJustification ? justification.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-elevated w-full max-w-md mx-4 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {isNextStep
              ? <ArrowRight size={16} className="text-success" />
              : <ArrowLeft size={16} className="text-warning" />}
            <h2 className="text-sm font-semibold">
              {isNextStep ? 'Next Step' : 'Move Back'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Move summary */}
          <div className="flex items-center gap-3 text-sm bg-muted rounded-lg px-3 py-2">
            <span className="font-mono font-semibold text-xs">{orderId}</span>
            <span className="text-muted-foreground text-xs">{currentArea}</span>
            {isNextStep
              ? <ArrowRight size={14} className="text-success shrink-0" />
              : <ArrowLeft size={14} className="text-warning shrink-0" />}
            <span className={cn(
              'text-xs font-semibold',
              isNextStep ? 'text-success' : 'text-warning'
            )}>{targetArea}</span>
          </div>

          {/* Blocked reason */}
          {blockedReason && (
            <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg border border-destructive/20">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{blockedReason}</span>
            </div>
          )}

          {/* Justification (move back) */}
          {!blockedReason && requiresJustification && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Justification <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal"> (required for move back)</span>
              </label>
              <textarea
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="Explain why this order is being moved back…"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                autoFocus
              />
              {justification.trim().length > 0 && justification.trim().length < 5 && (
                <p className="text-[10px] text-warning mt-1">At least 5 characters required</p>
              )}
            </div>
          )}

          {/* Next step — no justification needed, just confirmation */}
          {!blockedReason && isNextStep && (
            <p className="text-xs text-muted-foreground">
              This order will be manually moved to <strong className="text-foreground">{targetArea}</strong>.
              It will be flagged as <em>Manual</em> source. If the next SAP upload indicates a different area,
              a discrepancy will be flagged.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            Cancel
          </button>
          {!blockedReason && (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50',
                isNextStep
                  ? 'bg-success text-success-foreground hover:bg-success/90'
                  : 'bg-warning text-warning-foreground hover:bg-warning/90'
              )}
            >
              {submitting ? 'Moving…' : isNextStep ? 'Confirm Next Step' : 'Confirm Move Back'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Discrepancy Badge
// ============================================================
export function DiscrepancyBadge({ sapArea }: { sapArea?: Area }) {
  return (
    <span
      title={sapArea ? `SAP mapping says: ${sapArea}` : 'Manual placement conflicts with SAP status'}
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 leading-none shrink-0"
    >
      <AlertTriangle size={8} />
      DISC
    </span>
  );
}

// ============================================================
// Source Badge (manual/system indicator)
// ============================================================
export function SourceBadge({ source }: { source?: 'manual' | 'system' }) {
  if (!source || source === 'system') return null;
  return (
    <span className="inline-flex items-center text-[9px] font-semibold px-1 py-0.5 rounded bg-info/10 text-info border border-info/20 leading-none shrink-0">
      MANUAL
    </span>
  );
}
