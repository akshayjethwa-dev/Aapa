// src/screens/Orders.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  ArrowLeft, RefreshCw, Clock, CheckCircle2,
  XCircle, Ban, Pencil, X as CancelIcon, AlertTriangle,
  TrendingUp, Loader2
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { apiClient } from '../api/client';
import { toast } from 'sonner';
import OrderWindow, { OrderConfig } from './OrderWindow';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Order {
  order_id: string;
  exchange_order_id?: string;
  symbol: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  average_price: number;
  trigger_price?: number;
  validity?: string;
  status: string;       // normalized: pending | open | partially_filled | completed | cancelled | rejected
  raw_status?: string;  // original broker status, for debug
  type: string;
  order_type: string;
  product: string;
  placed_at: string;
  modified_at?: string;
  completed_at?: string;
  broker: string;
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
type FilterTab = 'ALL' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'PENDING',   label: 'Pending'   },
  { key: 'EXECUTED',  label: 'Executed'  },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'REJECTED',  label: 'Rejected'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isModifiable = (status: string) => {
  const s = status.toLowerCase();
  return s === 'open' || s === 'pending';
};

const isCancellable = (status: string) => {
  const s = status.toLowerCase();
  return s === 'open' || s === 'pending' || s === 'partially_filled';
};

const applyFilter = (orders: Order[], filter: FilterTab): Order[] => {
  if (filter === 'ALL') return orders;
  return orders.filter(o => {
    const s = o.status;
    if (filter === 'PENDING')   return s === 'pending' || s === 'open' || s === 'partially_filled';
    if (filter === 'EXECUTED')  return s === 'completed';
    if (filter === 'CANCELLED') return s === 'cancelled';
    if (filter === 'REJECTED')  return s === 'rejected';
    return true;
  });
};

// ─── Status Config ────────────────────────────────────────────────────────────
const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        color: 'text-emerald-500',
        bg:    'bg-emerald-500/10',
        icon:  CheckCircle2,
        label: 'EXECUTED',
      };
    case 'partially_filled':
      return {
        color: 'text-sky-400',
        bg:    'bg-sky-400/10',
        icon:  TrendingUp,
        label: 'PARTIAL',
      };
    case 'rejected':
      return {
        color: 'text-rose-500',
        bg:    'bg-rose-500/10',
        icon:  XCircle,
        label: 'REJECTED',
      };
    case 'cancelled':
      return {
        color: 'text-zinc-400',
        bg:    'bg-zinc-400/10',
        icon:  Ban,
        label: 'CANCELLED',
      };
    case 'open':
      return {
        color: 'text-violet-400',
        bg:    'bg-violet-400/10',
        icon:  Loader2,
        label: 'OPEN',
      };
    default: // pending
      return {
        color: 'text-amber-400',
        bg:    'bg-amber-400/10',
        icon:  Clock,
        label: 'PENDING',
      };
  }
};

// ─── Fill Progress Bar ────────────────────────────────────────────────────────
const FillBar = ({ filled, total }: { filled: number; total: number }) => {
  if (total === 0) return null;
  const pct = Math.min(100, Math.round((filled / total) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Fill</span>
        <span className="text-[9px] text-zinc-400 font-bold">{filled}/{total} ({pct}%)</span>
      </div>
      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-sky-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ─── Badge Count ──────────────────────────────────────────────────────────────
const tabCount = (orders: Order[], tab: FilterTab): number => {
  if (tab === 'ALL') return orders.length;
  return applyFilter(orders, tab).length;
};

// ─── Component ────────────────────────────────────────────────────────────────
const Orders = ({ onBack }: { onBack: () => void }) => {
  const { token } = useAuthStore();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterTab>('ALL');

  const [modifyConfig, setModifyConfig]   = useState<OrderConfig | null>(null);
  const [modifyOrderId, setModifyOrderId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading]     = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      const res = await apiClient.get('/api/orders');
      if (res.data) {
        setOrders(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error('Failed to fetch orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredOrders = applyFilter(orders, filter);

  // ── Modify ─────────────────────────────────────────────────────────────────
  const handleModify = (order: Order) => {
    const cfg: OrderConfig = {
      side:            order.type.toUpperCase() as 'BUY' | 'SELL',
      symbol:          order.symbol,
      price:           order.average_price > 0 ? order.average_price : order.price,
      defaultQty:      order.quantity,
      defaultProduct:  (order.product.toUpperCase() === 'MIS' ? 'MIS' : 'NRML') as any,
      _isModify:       true,
      _orderId:        order.order_id,
      _orderType:      order.order_type as any,
      _validity:       (order.validity ?? 'DAY') as any,
      _triggerPrice:   order.trigger_price ?? 0,
    };
    setModifyOrderId(order.order_id);
    setModifyConfig(cfg);
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancelConfirm = async (orderId: string) => {
    setCancelLoading(true);
    try {
      const res = await apiClient.delete(`/api/orders/${orderId}`);
      if (res.data?.success) {
        toast.success('Order cancelled successfully');
        setOrders(prev =>
          prev.map(o => o.order_id === orderId ? { ...o, status: 'cancelled' } : o)
        );
      } else {
        toast.error(res.data?.message || 'Failed to cancel order');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Network error. Could not cancel order.');
    } finally {
      setCancelLoading(false);
      setCancelConfirmId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {modifyConfig && (
          <OrderWindow
            config={modifyConfig}
            onClose={() => { setModifyConfig(null); setModifyOrderId(null); }}
            onOrderPlaced={() => { fetchOrders(); setModifyConfig(null); setModifyOrderId(null); }}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-black text-white pb-24">

        {/* ── Header ── */}
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-zinc-900 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight">Orders</h1>
              {orders.length > 0 && (
                <p className="text-[10px] text-zinc-500 font-bold tracking-widest -mt-0.5">
                  {orders.length} TOTAL
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchOrders(); }}
            className={cn('p-2 rounded-xl bg-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-800', loading && 'animate-spin')}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTER_TABS.map(({ key, label }) => {
              const count = tabCount(orders, key);
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase whitespace-nowrap transition-all',
                    isActive ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-4.5 text-center',
                      isActive ? 'bg-black/20 text-black' : 'bg-zinc-700 text-zinc-300'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Order List ── */}
        <div className="px-6 pt-2 space-y-3">
          {loading && orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={20} className="animate-spin text-zinc-500" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading Orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center">
                <AlertTriangle size={20} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                No {filter !== 'ALL' ? filter.toLowerCase() : ''} Orders
              </p>
              {filter !== 'ALL' && (
                <button
                  onClick={() => setFilter('ALL')}
                  className="text-[10px] font-black text-zinc-400 underline uppercase tracking-widest"
                >
                  View All
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, i) => {
                const statusConfig = getStatusConfig(order.status);
                const StatusIcon = statusConfig.icon;
                const canModify = isModifiable(order.status);
                const canCancel = isCancellable(order.status);
                const isPartial = order.status === 'partially_filled';
                const isConfirmingCancel = cancelConfirmId === order.order_id;
                const isSpinIcon = order.status === 'open';

                return (
                  <motion.div
                    key={order.order_id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4"
                  >
                    {/* ── Top row ── */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest',
                            order.type.toUpperCase() === 'BUY'
                              ? 'text-emerald-500 bg-emerald-500/10'
                              : 'text-rose-500 bg-rose-500/10'
                          )}>
                            {order.type}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            {order.product} · {order.order_type}
                          </span>
                          {order.validity && (
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                              {order.validity}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-black truncate">{order.symbol}</h3>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{order.broker}</p>
                      </div>

                      {/* Status Badge */}
                      <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg ml-3 shrink-0',
                        statusConfig.bg, statusConfig.color
                      )}>
                        <StatusIcon
                          size={12}
                          className={isSpinIcon ? 'animate-spin' : ''}
                        />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* ── Partial Fill Progress Bar ── */}
                    {isPartial && (
                      <FillBar filled={order.filled_quantity} total={order.quantity} />
                    )}

                    {/* ── Stats Grid ── */}
                    <div className={cn(
                      'grid gap-4 pt-3 border-t border-zinc-800/50 mt-2',
                      isPartial ? 'grid-cols-4' : 'grid-cols-3'
                    )}>
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Qty</p>
                        <p className="text-xs font-black">
                          {isPartial
                            ? <span>{order.filled_quantity}<span className="text-zinc-600">/{order.quantity}</span></span>
                            : order.quantity
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">
                          {order.average_price > 0 ? 'Avg Price' : 'Price'}
                        </p>
                        <p className="text-xs font-black">
                          {order.average_price > 0
                            ? formatCurrency(order.average_price)
                            : order.price > 0
                              ? formatCurrency(order.price)
                              : <span className="text-zinc-600">MKT</span>
                          }
                        </p>
                      </div>

                      {isPartial && (
                        <div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Limit</p>
                          <p className="text-xs font-black">
                            {order.price > 0 ? formatCurrency(order.price) : <span className="text-zinc-600">—</span>}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Time</p>
                        <p className="text-xs font-black text-zinc-400">
                          {order.placed_at
                            ? new Date(order.placed_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit', hour12: true
                              })
                            : '—'
                          }
                        </p>
                      </div>
                    </div>

                    {/* ── Trigger Price (if SL order) ── */}
                    {(order.trigger_price && order.trigger_price > 0) && (
                      <div className="mt-2 pt-2 border-t border-zinc-800/30">
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                          Trigger: {formatCurrency(order.trigger_price)}
                        </span>
                      </div>
                    )}

                    {/* ── Actions ── */}
                    {(canModify || canCancel) && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/50">
                        {isConfirmingCancel ? (
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-zinc-400 font-bold flex-1">Cancel this order?</p>
                            <button
                              onClick={() => handleCancelConfirm(order.order_id)}
                              disabled={cancelLoading}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                            >
                              {cancelLoading ? 'Cancelling...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(null)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {canModify && (
                              <button
                                onClick={() => handleModify(order)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-colors"
                              >
                                <Pencil size={11} />
                                Modify
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => setCancelConfirmId(order.order_id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
                              >
                                <CancelIcon size={11} />
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Exchange Order ID (small, bottom) ── */}
                    {order.exchange_order_id && (
                      <p className="mt-2 text-[9px] text-zinc-700 font-mono truncate">
                        Exch: {order.exchange_order_id}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
};

export default Orders;