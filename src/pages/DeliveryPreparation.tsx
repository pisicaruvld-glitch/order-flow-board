import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/lib/types';
import { getLogisticsOrdersWorklist } from '@/lib/api';
import {
  Pallet, PalletLine, PalletStatus,
  getPallets, getPallet, createPallet, updatePallet,
  addPalletLines, updatePalletLine, deletePalletLine, shipPallet,
} from '@/lib/palletApi';
import { PageContainer, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { RefreshCw, Plus, Package, Trash2, Edit2, Send, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function DeliveryPreparationPage() {
  const navigate = useNavigate();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create pallet form
  const [showCreate, setShowCreate] = useState(false);
  const [newPalletNo, setNewPalletNo] = useState('');
  const [newWeightKg, setNewWeightKg] = useState<number>(0);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);

  // Detail view
  const [expandedPallet, setExpandedPallet] = useState<number | null>(null);
  const [palletDetails, setPalletDetails] = useState<Record<number, Pallet>>({});

  // Edit line
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  // Add lines to existing pallet
  const [addingToPallet, setAddingToPallet] = useState<number | null>(null);
  const [addOrderSelections, setAddOrderSelections] = useState<Record<string, number>>({});

  // Ship dialog
  const [shippingPallet, setShippingPallet] = useState<number | null>(null);
  const [shipDoc, setShipDoc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o] = await Promise.all([getPallets(), getLogisticsOrdersWorklist()]);
      setPallets(p);
      setOrders(o);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logisticsOrders = orders.filter(o => (o.available_in_logistics_qty ?? 0) > 0 && o.product_type !== 'SFG');

  const handleCreate = async () => {
    if (!newPalletNo.trim()) { toast.error('Pallet number is required'); return; }
    const lines = Object.entries(selectedOrders)
      .filter(([, qty]) => qty > 0)
      .map(([order_id, qty_on_pallet]) => ({ order_id, qty_on_pallet }));
    if (lines.length === 0) { toast.error('Add at least one order line'); return; }
    setCreating(true);
    try {
      await createPallet({
        pallet_no: newPalletNo.trim(),
        pallet_weight_kg: newWeightKg,
        lines,
      });
      toast.success('Pallet created');
      setShowCreate(false);
      setNewPalletNo('');
      setNewWeightKg(0);
      
      setSelectedOrders({});
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create pallet');
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = async (palletId: number) => {
    if (expandedPallet === palletId) {
      setExpandedPallet(null);
      return;
    }
    setExpandedPallet(palletId);
    try {
      const detail = await getPallet(palletId);
      setPalletDetails(prev => ({ ...prev, [palletId]: detail }));
    } catch (e) {
      console.error("Failed to load pallet details", e);
      toast.error('Failed to load pallet details');
    }
  };

  const handleUpdateLine = async (lineId: number) => {
    try {
      await updatePalletLine(lineId, { qty_on_pallet: editQty });
      toast.success('Line updated');
      setEditingLine(null);
      if (expandedPallet) {
        const detail = await getPallet(expandedPallet);
        setPalletDetails(prev => ({ ...prev, [expandedPallet!]: detail }));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleDeleteLine = async (lineId: number) => {
    try {
      await deletePalletLine(lineId);
      toast.success('Line removed');
      if (expandedPallet) {
        const detail = await getPallet(expandedPallet);
        setPalletDetails(prev => ({ ...prev, [expandedPallet!]: detail }));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  const handleAddLines = async (palletId: number) => {
    const lines = Object.entries(addOrderSelections)
      .filter(([, qty]) => qty > 0)
      .map(([order_id, qty_on_pallet]) => ({ order_id, qty_on_pallet }));
    if (lines.length === 0) { toast.error('Select at least one order'); return; }
    try {
      await addPalletLines(palletId, { lines });
      toast.success('Lines added');
      setAddingToPallet(null);
      setAddOrderSelections({});
      const detail = await getPallet(palletId);
      setPalletDetails(prev => ({ ...prev, [palletId]: detail }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add lines');
    }
  };

  const handleMarkReady = async (palletId: number) => {
    try {
      await updatePallet(palletId, { status: 'READY' });
      toast.success('Pallet marked as READY');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleShip = async () => {
    if (!shippingPallet) return;
    try {
      await shipPallet(shippingPallet, {
        shipped_doc: shipDoc.trim() || undefined,
      });
      toast.success('Pallet shipped');
      setShippingPallet(null);
      setShipDoc('');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to ship');
    }
  };

  const statusColor = (s: PalletStatus) => {
    if (s === 'SHIPPED') return 'bg-success/10 text-success border-success/30';
    if (s === 'READY') return 'bg-primary/10 text-primary border-primary/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <PageContainer>
      <PageHeader
        title="Pregătire livrare"
        subtitle={`${pallets.length} pallets`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/logistics')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} />Back
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors">
              <Plus size={14} />New Pallet
            </button>
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      {loading && <LoadingSpinner label="Loading…" />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Create Pallet Form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Create Pallet</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Pallet No *</label>
              <input
                value={newPalletNo}
                onChange={e => setNewPalletNo(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. PAL-001"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Weight (kg)</label>
              <input
                type="number"
                min={0}
                value={newWeightKg}
                onChange={e => setNewWeightKg(Number(e.target.value))}
                className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Order selection */}
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Select orders & quantities</p>
            {logisticsOrders.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No orders in Logistics.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded p-2">
                {logisticsOrders.map(o => {
                  const maxQty = o.available_in_logistics_qty ?? 0;
                  return (
                    <div key={o.card_key ?? o.Order} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!selectedOrders[o.Order]}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedOrders(prev => ({ ...prev, [o.Order]: 1 }));
                          } else {
                            setSelectedOrders(prev => { const n = { ...prev }; delete n[o.Order]; return n; });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="font-mono text-[10px]">{o.Order}</span>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{o.Material_description ?? '-'}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">Avail: {maxQty}</span>
                      {selectedOrders[o.Order] !== undefined && (
                        <input
                          type="number"
                          min={0}
                          max={maxQty}
                          value={selectedOrders[o.Order] ?? 0}
                          onChange={e => setSelectedOrders(prev => ({ ...prev, [o.Order]: Math.max(0, Math.min(maxQty, parseInt(e.target.value) || 0)) }))}
                          className="w-16 px-1 py-0.5 text-[10px] bg-background border border-border rounded text-right"
                          placeholder="Qty"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create Pallet'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setSelectedOrders({}); }}
              className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ship Dialog */}
      {shippingPallet && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShippingPallet(null)}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Ship Pallet</h3>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Document / Tracking (optional)</label>
              <input value={shipDoc} onChange={e => setShipDoc(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. AWB-12345" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleShip} className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Send size={11} className="inline mr-1" />Confirm Ship
              </button>
              <button onClick={() => setShippingPallet(null)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pallets List */}
      {!loading && !error && (
        <div className="space-y-2">
          {pallets.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No pallets yet. Click "New Pallet" to create one.</p>
          ) : (
            pallets.map(pallet => {
              const isExpanded = expandedPallet === pallet.id;
              const detail = palletDetails[pallet.id];
              return (
                <div key={pallet.id} className="bg-card border border-border rounded-lg">
                  {/* Header */}
                  <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(pallet.id)}>
                    {isExpanded ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                    <Package size={14} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold">{pallet.pallet_no}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', statusColor(pallet.status))}>
                          {pallet.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{pallet.pallet_weight_kg} kg</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Created {new Date(pallet.created_at).toLocaleDateString()} by {pallet.created_by}
                        {pallet.shipped_at && <> · Shipped {new Date(pallet.shipped_at).toLocaleDateString()}</>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {pallet.status === 'DRAFT' && (
                        <button onClick={() => handleMarkReady(pallet.id)} className="px-2 py-1 text-[10px] font-medium rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                          Mark Ready
                        </button>
                      )}
                      {pallet.status !== 'SHIPPED' && (
                        <button onClick={() => setShippingPallet(pallet.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Send size={10} />Ship
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detail (expanded) */}
                  {isExpanded && detail && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                      {/* Lines */}
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-muted-foreground">Lines ({detail.lines?.length ?? 0})</p>
                        {pallet.status !== 'SHIPPED' && (
                          <button
                            onClick={() => { setAddingToPallet(addingToPallet === pallet.id ? null : pallet.id); setAddOrderSelections({}); }}
                            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                          >
                            <Plus size={10} />Add orders
                          </button>
                        )}
                      </div>

                      {(detail.lines ?? []).length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">No lines.</p>
                      ) : (
                        <div className="space-y-1">
                          {(detail.lines ?? []).map(line => (
                            <div key={line.id} className="flex items-center gap-3 text-[10px] bg-muted rounded px-2 py-1.5">
                              <span className="font-mono font-semibold">{line.order_number ?? line.order_id}</span>
                              <span className="text-muted-foreground truncate flex-1">{line.material_description ?? line.material ?? ''}</span>
                              {editingLine === line.id ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editQty}
                                    onChange={e => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-16 px-1 py-0.5 text-[10px] bg-background border border-border rounded text-right"
                                  />
                                  <button onClick={() => handleUpdateLine(line.id)} className="text-primary hover:text-primary/80">Save</button>
                                  <button onClick={() => setEditingLine(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <span>Qty: <strong className="text-foreground">{line.qty_on_pallet}</strong></span>
                                  {pallet.status !== 'SHIPPED' && (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => { setEditingLine(line.id); setEditQty(line.qty_on_pallet); }} className="text-muted-foreground hover:text-foreground">
                                        <Edit2 size={10} />
                                      </button>
                                      <button onClick={() => handleDeleteLine(line.id)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add lines form */}
                      {addingToPallet === pallet.id && (
                        <div className="border border-border rounded p-2 space-y-2">
                          <p className="text-[10px] font-medium text-muted-foreground">Add orders to pallet</p>
                          {logisticsOrders.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">No orders available.</p>
                          ) : (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {logisticsOrders.map(o => {
                                const maxQty = o.available_in_logistics_qty ?? 0;
                                return (
                                  <div key={o.Order} className="flex items-center gap-2 text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={!!addOrderSelections[o.Order]}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setAddOrderSelections(prev => ({ ...prev, [o.Order]: 1 }));
                                        } else {
                                          setAddOrderSelections(prev => { const n = { ...prev }; delete n[o.Order]; return n; });
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="font-mono">{o.Order}</span>
                                    <span className="text-muted-foreground truncate flex-1">{o.Material_description ?? '-'}</span>
                                    <span className="text-muted-foreground shrink-0">Avail: {maxQty}</span>
                                    {addOrderSelections[o.Order] !== undefined && (
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxQty}
                                        value={addOrderSelections[o.Order] ?? 0}
                                        onChange={e => setAddOrderSelections(prev => ({ ...prev, [o.Order]: Math.max(0, Math.min(maxQty, parseInt(e.target.value) || 0)) }))}
                                        className="w-16 px-1 py-0.5 text-[10px] bg-background border border-border rounded text-right"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleAddLines(pallet.id)} className="px-2 py-1 text-[10px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                              Add Lines
                            </button>
                            <button onClick={() => { setAddingToPallet(null); setAddOrderSelections({}); }} className="px-2 py-1 text-[10px] text-muted-foreground border border-border rounded hover:bg-muted transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </PageContainer>
  );
}
