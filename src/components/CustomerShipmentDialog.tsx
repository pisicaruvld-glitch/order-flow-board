import { useState } from 'react';
import { AlertTriangle, Truck, X } from 'lucide-react';

interface CustomerShipmentDialogProps {
  orderId: string;
  availableToShip?: number;
  onConfirm: (data: { shipped_qty_delta: number; shipped_doc?: string }) => Promise<void>;
  onCancel: () => void;
}

export function CustomerShipmentDialog({ orderId, availableToShip, onConfirm, onCancel }: CustomerShipmentDialogProps) {
  const [shippedQty, setShippedQty] = useState<string>('');
  const [shippedDoc, setShippedDoc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const shipped = parseInt(shippedQty) || 0;
  const exceedsAvailable = availableToShip != null && availableToShip > 0 && shipped > availableToShip;
  const canConfirm = shippedQty.trim() !== '' && shipped >= 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await onConfirm({
        shipped_qty_delta: shipped,
        ...(shippedDoc.trim() ? { shipped_doc: shippedDoc.trim() } : {}),
      });
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
            <Truck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Ship to Customer</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 text-sm bg-muted rounded-lg px-3 py-2">
            <span className="font-mono font-semibold text-xs">{orderId}</span>
            {availableToShip != null && (
              <span className="text-muted-foreground text-xs ml-auto">Available: {availableToShip}</span>
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
              Shipped qty <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={shippedQty}
              onChange={e => setShippedQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {exceedsAvailable && (
              <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> Exceeds available to ship ({availableToShip})
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Document / Tracking <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              value={shippedDoc}
              onChange={e => setShippedDoc(e.target.value)}
              placeholder="e.g. DN-12345"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
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
            {submitting ? 'Saving…' : 'Ship to Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
