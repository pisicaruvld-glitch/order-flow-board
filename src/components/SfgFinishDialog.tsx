import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

interface SfgFinishDialogProps {
  orderId: string;
  orderQty: number;
  currentFinished: number;
  currentScrap: number;
  onConfirm: (data: { finished_qty_delta: number; scrap_qty_delta: number; reported_by: string; auto_complete: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function SfgFinishDialog({ orderId, orderQty, currentFinished, currentScrap, onConfirm, onCancel }: SfgFinishDialogProps) {
  const [finishedDelta, setFinishedDelta] = useState(0);
  const [scrapDelta, setScrapDelta] = useState(0);
  const [reportedBy, setReportedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const newFinished = currentFinished + finishedDelta;
  const newScrap = currentScrap + scrapDelta;
  const remaining = Math.max(0, orderQty - newFinished);
  const willComplete = remaining === 0 && finishedDelta > 0;

  // Validation
  const finishedValid = finishedDelta >= 0;
  const scrapValid = scrapDelta >= 0 && newScrap <= newFinished;
  const finishedNotExceed = newFinished <= orderQty;
  const reportedByValid = reportedBy.trim().length > 0;
  const hasDelta = finishedDelta > 0 || scrapDelta > 0;
  const canSubmit = finishedValid && scrapValid && finishedNotExceed && reportedByValid && hasDelta && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({
        finished_qty_delta: finishedDelta,
        scrap_qty_delta: scrapDelta,
        reported_by: reportedBy.trim(),
        auto_complete: willComplete,
      });
      if (willComplete) {
        setSuccess(true);
      }
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Dialog open onOpenChange={() => onCancel()}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 size={48} className="text-success" />
            <p className="text-lg font-semibold text-foreground">Production Completed!</p>
            <p className="text-sm text-muted-foreground text-center">
              Order {orderId} has reached full quantity and is now completed in Production.
            </p>
            <Button onClick={onCancel}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Finished — {orderId}</DialogTitle>
          <DialogDescription>
            Record finished and scrap quantities for this semifinished order.
          </DialogDescription>
        </DialogHeader>

        {/* Current state */}
        <div className="bg-muted rounded-md p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Qty:</span>
            <span className="font-semibold text-foreground">{orderQty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Finished:</span>
            <span className="font-semibold text-foreground">{currentFinished}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Scrap:</span>
            <span className="font-semibold text-foreground">{currentScrap}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sfg-finished">Finished Qty Delta *</Label>
            <Input
              id="sfg-finished"
              type="number"
              min={0}
              max={orderQty - currentFinished}
              value={finishedDelta}
              onChange={e => setFinishedDelta(Math.max(0, parseInt(e.target.value) || 0))}
            />
            {!finishedNotExceed && (
              <p className="text-[10px] text-destructive mt-0.5">Total finished ({newFinished}) exceeds order qty ({orderQty})</p>
            )}
          </div>
          <div>
            <Label htmlFor="sfg-scrap">Scrap Qty Delta</Label>
            <Input
              id="sfg-scrap"
              type="number"
              min={0}
              value={scrapDelta}
              onChange={e => setScrapDelta(Math.max(0, parseInt(e.target.value) || 0))}
            />
            {!scrapValid && (
              <p className="text-[10px] text-destructive mt-0.5">Total scrap ({newScrap}) cannot exceed total finished ({newFinished})</p>
            )}
          </div>
          <div>
            <Label htmlFor="sfg-reporter">Reported By *</Label>
            <Input
              id="sfg-reporter"
              value={reportedBy}
              onChange={e => setReportedBy(e.target.value)}
              placeholder="Name"
            />
          </div>
        </div>

        {/* Preview */}
        {hasDelta && (
          <div className="bg-muted rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Total Finished:</span>
              <span className="font-semibold text-foreground">{newFinished}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Total Scrap:</span>
              <span className="font-semibold text-foreground">{newScrap}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className={`font-semibold ${remaining === 0 ? 'text-success' : 'text-foreground'}`}>{remaining}</span>
            </div>
            {willComplete && (
              <p className="text-success font-semibold mt-1">✓ Order will be marked as COMPLETED</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Report Finished'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
