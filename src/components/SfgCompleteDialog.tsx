import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SfgCompleteDialogProps {
  orderId: string;
  orderQty: number;
  onConfirm: (data: { gross_finished_qty: number; scrap_qty: number; updated_by: string }) => Promise<void>;
  onCancel: () => void;
}

export function SfgCompleteDialog({ orderId, orderQty, onConfirm, onCancel }: SfgCompleteDialogProps) {
  const [grossQty, setGrossQty] = useState(0);
  const [scrapQty, setScrapQty] = useState(0);
  const [updatedBy, setUpdatedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grossValid = grossQty >= 0;
  const scrapValid = scrapQty >= 0 && scrapQty <= grossQty;
  const hasDelta = grossQty > 0 || scrapQty > 0;
  const updatedByValid = updatedBy.trim().length > 0;
  const goodQty = grossQty - scrapQty;
  const canSubmit = grossValid && scrapValid && hasDelta && updatedByValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        gross_finished_qty: grossQty,
        scrap_qty: scrapQty,
        updated_by: updatedBy.trim(),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete SFG — {orderId}</DialogTitle>
          <DialogDescription>
            Enter production quantities for this semifinished order. Backend accumulates totals.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted rounded-md p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Qty:</span>
            <span className="font-semibold text-foreground">{orderQty}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sfg-gross">Gross Finished Qty (delta) *</Label>
            <Input
              id="sfg-gross"
              type="number"
              min={0}
              value={grossQty}
              onChange={e => setGrossQty(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div>
            <Label htmlFor="sfg-scrap">Scrap Qty (delta) *</Label>
            <Input
              id="sfg-scrap"
              type="number"
              min={0}
              value={scrapQty}
              onChange={e => setScrapQty(Math.max(0, parseInt(e.target.value) || 0))}
            />
            {!scrapValid && (
              <p className="text-[10px] text-destructive mt-0.5">Scrap ({scrapQty}) cannot exceed gross finished ({grossQty})</p>
            )}
          </div>
          <div>
            <Label htmlFor="sfg-updater">Updated By *</Label>
            <Input
              id="sfg-updater"
              value={updatedBy}
              onChange={e => setUpdatedBy(e.target.value)}
              placeholder="Name"
            />
          </div>
        </div>

        {hasDelta && (
          <div className="bg-muted rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Good Finished (this batch):</span>
              <span className="font-semibold text-foreground">{goodQty}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Backend will accumulate totals and decide final status.</p>
          </div>
        )}

        {!hasDelta && (
          <p className="text-[10px] text-warning">gross_finished_qty or scrap_qty must be &gt; 0</p>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Confirm Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
