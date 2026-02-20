import { useState, useEffect, useCallback } from 'react';
import { Order, Issue, IssueHistoryEntry, StatusMapping, ISSUE_TYPES, AreaModes } from '@/lib/types';
import { getOrders, getStatusMappings, getIssues, createIssue, patchIssue, getIssueHistory, markOrderReady, moveOrder, getAreaModes } from '@/lib/api';
import { AppConfig } from '@/lib/types';
import { PageContainer, LoadingSpinner, ErrorMessage } from '@/components/Layout';
import { StatusBadge, IssueBadge } from '@/components/Badges';
import { OrderDetailPanel, PriorityIcon, ChangedBadge } from '@/components/OrderCard';
import { MoveOrderDialog, DiscrepancyBadge, SourceBadge } from '@/components/MoveOrderDialog';
import { GanttTimeline } from '@/components/GanttTimeline';
import { Plus, CheckCircle2, AlertTriangle, RefreshCw, History, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarehousePageProps {
  config: AppConfig;
}

type MoveDialogState = {
  orderId: string;
  isNextStep: boolean;
  blockedReason?: string;
} | null;

export default function WarehousePage({ config }: WarehousePageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [areaModes, setAreaModes] = useState<AreaModes>({ Warehouse: 'AUTO', Production: 'AUTO', Logistics: 'AUTO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [history, setHistory] = useState<Record<string, IssueHistoryEntry[]>>({});
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [addingIssue, setAddingIssue] = useState(false);
  const [newIssue, setNewIssue] = useState({ pn: '', issue_type: ISSUE_TYPES[0].value, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, m, modes] = await Promise.all([
        getOrders({ area: 'Warehouse' }),
        getStatusMappings(),
        getAreaModes(),
      ]);
      setOrders(o);
      setMappings(m);
      setAreaModes(modes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadIssues = useCallback(async (orderId: string) => {
    setIssueLoading(true);
    try {
      const result = await getIssues(orderId);
      setIssues(result);
    } finally {
      setIssueLoading(false);
    }
  }, []);

  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    loadIssues(order.Order);
    setAddingIssue(false);
    setShowHistoryId(null);
  };

  const handleAddIssue = async () => {
    if (!selectedOrder || !newIssue.pn || !newIssue.comment) return;
    setSubmitting(true);
    try {
      const created = await createIssue(selectedOrder.Order, newIssue);
      setIssues(prev => [...prev, created]);
      setNewIssue({ pn: '', issue_type: ISSUE_TYPES[0].value, comment: '' });
      setAddingIssue(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleIssue = async (issue: Issue) => {
    const updated = await patchIssue(issue.id, {
      status: issue.status === 'OPEN' ? 'CLOSED' : 'OPEN',
    });
    setIssues(prev => prev.map(i => i.id === issue.id ? updated : i));
  };

  const handleShowHistory = async (issueId: string) => {
    if (showHistoryId === issueId) { setShowHistoryId(null); return; }
    const h = await getIssueHistory(issueId);
    setHistory(prev => ({ ...prev, [issueId]: h }));
    setShowHistoryId(issueId);
  };

  const handleMarkReady = async () => {
    if (!selectedOrder) return;
    setMarkingReady(true);
    try {
      await markOrderReady(selectedOrder.Order);
      setOrders(prev => prev.filter(o => o.Order !== selectedOrder.Order));
      setSelectedOrder(null);
    } finally {
      setMarkingReady(false);
    }
  };

  const openNextStep = () => {
    if (!selectedOrder) return;
    const openCount = issues.filter(i => i.status === 'OPEN').length;
    setMoveDialog({
      orderId: selectedOrder.Order,
      isNextStep: true,
      blockedReason: openCount > 0 ? `Cannot move to Production: ${openCount} open issue(s) must be closed first.` : undefined,
    });
  };

  const openMoveBack = () => {
    if (!selectedOrder) return;
    setMoveDialog({
      orderId: selectedOrder.Order,
      isNextStep: false,
    });
  };

  const handleMoveConfirm = async (justification?: string) => {
    if (!moveDialog || !selectedOrder) return;
    const target = moveDialog.isNextStep ? 'Production' : 'Orders';
    await moveOrder({
      order_id: moveDialog.orderId,
      target_area: target,
      justification,
    });
    setOrders(prev => prev.filter(o => o.Order !== moveDialog.orderId));
    setSelectedOrder(null);
    setMoveDialog(null);
  };

  const openIssues = issues.filter(i => i.status === 'OPEN');
  const closedIssues = issues.filter(i => i.status === 'CLOSED');
  const canMarkReady = openIssues.length === 0;
  const isManualMode = areaModes.Warehouse === 'MANUAL';

  const groupCounts: Record<string, number> = {};
  orders.forEach(o => {
    const m = mappings.find(s => s.system_status_value === o.System_Status);
    const label = m ? m.mapped_label : o.System_Status;
    groupCounts[label] = (groupCounts[label] || 0) + 1;
  });

  return (
    <PageContainer className="flex flex-col gap-0 p-0">
      {/* Summary strip */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-2xl font-bold">{orders.length}</span>
            <span className="text-sm text-muted-foreground ml-1.5">orders in Warehouse</span>
          </div>
          {Object.entries(groupCounts).map(([label, count]) => (
            <div key={label} className="text-sm">
              <span className="font-semibold text-area-warehouse">{count}</span>
              <span className="text-muted-foreground ml-1">{label}</span>
            </div>
          ))}
          {/* Mode badge */}
          <span className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded border',
            isManualMode
              ? 'bg-warning/10 text-warning border-warning/30'
              : 'bg-success/10 text-success border-success/30'
          )}>
            {isManualMode ? 'MANUAL mode' : 'AUTO mode'}
          </span>
          <button onClick={load} className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Work Queue */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto scrollbar-thin bg-background">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Work Queue</h2>
          </div>
          {loading && <LoadingSpinner label="Loading queue…" />}
          {error && <ErrorMessage message={error} onRetry={load} />}
          {!loading && !error && orders.map(order => (
            <button
              key={order.Order}
              onClick={() => selectOrder(order)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border hover:bg-muted/60 transition-colors',
                selectedOrder?.Order === order.Order && 'bg-primary-subtle border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PriorityIcon priority={order.Priority} />
                  <span className="font-mono text-xs font-semibold">{String(order?.Order ?? '')}</span>
                  {order.has_changes && <ChangedBadge fields={order.changed_fields} />}
                  {order.discrepancy && <DiscrepancyBadge sapArea={order.sap_area} />}
                  {order.source === 'manual' && <SourceBadge source={order.source} />}
                </div>
                <StatusBadge status={String(order?.System_Status ?? '')} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{String(order?.Material_description ?? '')}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{String(order?.Plant ?? '')}</span>
                <span className="text-xs font-medium">{Number(order?.Order_quantity ?? 0)} units</span>
              </div>
            </button>
          ))}
          {!loading && orders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No orders in warehouse</p>
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 bg-background">
          {!selectedOrder ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <p className="text-sm">← Select an order from the queue</p>
            </div>
          ) : (
            <OrderDetailPanel order={selectedOrder}>
              {/* Issues Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Issues
                    {openIssues.length > 0 && (
                      <span className="bg-destructive/10 text-destructive text-xs font-medium px-1.5 rounded">
                        {openIssues.length} open
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setAddingIssue(!addingIssue)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} />Add Issue
                  </button>
                </div>

                {/* Add Issue Form */}
                {addingIssue && (
                  <div className="bg-muted rounded-lg p-3 mb-3 space-y-2 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Part Number (PN)</label>
                        <input
                          value={newIssue.pn}
                          onChange={e => setNewIssue(p => ({ ...p, pn: e.target.value }))}
                          placeholder="PN-XXXXX"
                          className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Issue Type</label>
                        <select
                          value={newIssue.issue_type}
                          onChange={e => setNewIssue(p => ({ ...p, issue_type: e.target.value as any }))}
                          className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {ISSUE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Comment</label>
                      <textarea
                        value={newIssue.comment}
                        onChange={e => setNewIssue(p => ({ ...p, comment: e.target.value }))}
                        placeholder="Describe the issue…"
                        rows={2}
                        className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddIssue}
                        disabled={submitting || !newIssue.pn || !newIssue.comment}
                        className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary-light disabled:opacity-50 transition-colors"
                      >
                        {submitting ? 'Submitting…' : 'Submit Issue'}
                      </button>
                      <button
                        onClick={() => setAddingIssue(false)}
                        className="px-3 py-1.5 border border-border text-xs rounded hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Issue List */}
                {issueLoading ? (
                  <LoadingSpinner label="Loading issues…" />
                ) : (
                  <div className="space-y-2">
                    {issues.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No issues reported</p>
                    )}
                    {issues.map(issue => (
                      <div key={issue.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-start gap-2 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <IssueBadge status={issue.status} />
                              <span className="font-mono text-xs text-muted-foreground">{issue.pn}</span>
                              <span className="text-xs text-muted-foreground">
                                {ISSUE_TYPES.find(t => t.value === issue.issue_type)?.label}
                              </span>
                            </div>
                            <p className="text-xs mt-1 text-foreground">{issue.comment}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              by {issue.created_by} · {new Date(issue.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleShowHistory(issue.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="History"
                            >
                              <History size={12} />
                            </button>
                            <button
                              onClick={() => handleToggleIssue(issue)}
                              className={cn(
                                'p-1 rounded hover:bg-muted',
                                issue.status === 'OPEN' ? 'text-success hover:text-success' : 'text-muted-foreground'
                              )}
                              title={issue.status === 'OPEN' ? 'Close issue' : 'Reopen issue'}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          </div>
                        </div>
                        {showHistoryId === issue.id && (
                          <div className="border-t border-border bg-muted px-3 py-2 space-y-1.5 animate-fade-in">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">History</p>
                            {(history[issue.id] || []).map(h => (
                              <div key={h.id} className="text-[10px] text-muted-foreground">
                                <span className="font-medium text-foreground">{h.action}</span>
                                {' '}by {h.changed_by} · {new Date(h.changed_at).toLocaleString()}
                                {h.details && <p className="mt-0.5 italic">{h.details}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  {openIssues.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-warning">
                      <AlertTriangle size={12} />
                      {openIssues.length} open issue(s) must be closed before moving to Production
                    </div>
                  )}

                  {/* AUTO mode: classic Mark Ready */}
                  {!isManualMode && (
                    <button
                      onClick={handleMarkReady}
                      disabled={!canMarkReady || markingReady || openIssues.length > 0}
                      className={cn(
                        'w-full py-2 rounded-md text-sm font-medium transition-colors',
                        canMarkReady && openIssues.length === 0
                          ? 'bg-success text-success-foreground hover:bg-success/90'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      {markingReady ? 'Marking…' : '✓ Mark Ready → Send to Production'}
                    </button>
                  )}

                  {/* MANUAL mode: Next Step + Move Back */}
                  {isManualMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={openMoveBack}
                        className="flex items-center gap-1.5 flex-1 justify-center py-2 border border-border text-xs font-medium rounded-md hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <ArrowLeft size={13} />
                        Move Back to Orders
                      </button>
                      <button
                        onClick={openNextStep}
                        className={cn(
                          'flex items-center gap-1.5 flex-1 justify-center py-2 text-xs font-medium rounded-md transition-colors',
                          openIssues.length > 0
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-success text-success-foreground hover:bg-success/90'
                        )}
                      >
                        <ArrowRight size={13} />
                        Next Step → Production
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Gantt Timeline */}
              <div className="px-4 pb-4">
                <GanttTimeline orderId={selectedOrder.Order} />
              </div>
            </OrderDetailPanel>
          )}
        </div>
      </div>

      {/* Move Dialog */}
      {moveDialog && selectedOrder && (
        <MoveOrderDialog
          orderId={moveDialog.orderId}
          currentArea="Warehouse"
          targetArea={moveDialog.isNextStep ? 'Production' : 'Orders'}
          isNextStep={moveDialog.isNextStep}
          blockedReason={moveDialog.blockedReason}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMoveDialog(null)}
        />
      )}
    </PageContainer>
  );
}
