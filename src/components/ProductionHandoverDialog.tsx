import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

interface ProductionHandoverDialogProps {
  orderId: string;
  orderQty?: number;
  remainingQty?: number;
  onConfirm: (data: { delivered_qty_delta: number; scrap_qty_delta: number }) => Promise<void>;
  onCancel: () => void;
}

export function ProductionHandoverDialog({ orderId, orderQty, remainingQty, onConfirm, onCancel }: ProductionHandoverDialogProps) {
  const [deliveredQty, setDeliveredQty] = useState<string>('');
  const [scrapQty, setScrapQty] = useState<string>('0');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const delivered = parseInt(deliveredQty) || 0;
  const scrap = parseInt(scrapQty) || 0;
  const scrapWarning = scrap > delivered && delivered > 0;
  const exceedsRemaining = remainingQty != null && delivered > remainingQty;
  const canConfirm = deliveredQty.trim() !== '' && delivered >= 0 && scrap >= 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await onConfirm({ delivered_qty_delta: delivered, scrap_qty_delta: scrap });
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
            <ArrowRight size={16} className="text-success" />
            <h2 className="text-sm font-semibold">Production → Logistics Shipment</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 text-sm bg-muted rounded-lg px-3 py-2">
            <span className="font-mono font-semibold text-xs">{orderId}</span>
            {orderQty != null && (
              <span className="text-muted-foreground text-xs ml-auto">
                Order qty: {orderQty}
                {remainingQty != null && <> · Remaining: <strong className="text-foreground">{remainingQty}</strong></>}
              </span>
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
              Delivered to Logistics <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={deliveredQty}
              onChange={e => setDeliveredQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {exceedsRemaining && (
              <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> Exceeds remaining qty ({remainingQty})
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Scrap</label>
            <input
              type="number"
              min={0}
              value={scrapQty}
              onChange={e => setScrapQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {scrapWarning && (
              <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> Scrap exceeds delivered qty
              </p>
            )}
          </div>

          {delivered > 0 && (
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
              This shipment finished qty: <strong className="text-foreground">{delivered - scrap}</strong>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onCancel} className="flex-1 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 bg-success text-success-foreground hover:bg-success/90"
          >
            {submitting ? 'Saving…' : 'Create Shipment'}
          </button>
        </div>
      </div>
    </div>
  );
}
