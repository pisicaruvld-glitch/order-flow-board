import { useState } from 'react';
import { AlertTriangle, Package, X } from 'lucide-react';

interface LogisticsReceiveDialogProps {
  shipmentId: number;
  orderId: string;
  finishedQtyDelta?: number;
  currentReceivedQty?: number | null;
  onConfirm: (data: { received_qty_delta: number }) => Promise<void>;
  onCancel: () => void;
}

export function LogisticsReceiveDialog({ shipmentId, orderId, finishedQtyDelta, currentReceivedQty, onConfirm, onCancel }: LogisticsReceiveDialogProps) {
  const [receivedQty, setReceivedQty] = useState<string>(currentReceivedQty != null ? String(currentReceivedQty) : '');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const received = parseInt(receivedQty) || 0;
  const exceedsFinished = finishedQtyDelta != null && finishedQtyDelta > 0 && received > finishedQtyDelta;
  const canConfirm = receivedQty.trim() !== '' && received >= 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await onConfirm({ received_qty_delta: received });
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to save');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-elevated w-full max-w-md mx-4 animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Receive Shipment</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 text-sm bg-muted rounded-lg px-3 py-2">
            <span className="font-mono font-semibold text-xs">{orderId}</span>
            <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">
              Shipment #{shipmentId}
            </span>
            {finishedQtyDelta != null && finishedQtyDelta > 0 && (
              <span className="text-muted-foreground text-xs ml-auto">Finished: {finishedQtyDelta}</span>
            )}
          </div>

          {apiError && (
            <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg border border-destructive/20">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Received qty <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={receivedQty}
              onChange={e => setReceivedQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {exceedsFinished && (
              <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> Received qty exceeds finished qty ({finishedQtyDelta})
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onCancel} className="flex-1 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? 'Saving…' : 'Confirm Receive'}
          </button>
        </div>
      </div>
    </div>
  );
}
