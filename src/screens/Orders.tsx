// src/screens/Orders.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  ArrowLeft, RefreshCw, Clock, CheckCircle2,
  XCircle, Ban, Pencil, X as CancelIcon, AlertTriangle
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
  status: string;
  type: string;
  order_type: string;
  product: string;
  placed_at: string;
  modified_at?: string;
  completed_at?: string;
  broker: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isModifiable = (status: string) => {
  const s = status.toLowerCase();
  return s === 'open' || s === 'pending' || s === 'trigger pending';
};

const isCancellable = (status: string) => {
  const s = status.toLowerCase();
  return s === 'open' || s === 'pending' || s === 'trigger pending';
};

// ─── Component ────────────────────────────────────────────────────────────────
const Orders = ({ onBack }: { onBack: () => void }) => {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED' | 'REJECTED'>('ALL');

  // Modify flow state
  const [modifyConfig, setModifyConfig] = useState<OrderConfig | null>(null);
  const [modifyOrderId, setModifyOrderId] = useState<string | null>(null);

  // Cancel confirmation state
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  // ── Status config ──────────────────────────────────────────────────────────
  const getStatusConfig = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'complete' || s === 'completed')
      return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2, label: 'EXECUTED' };
    if (s === 'rejected')
      return { color: 'text-rose-500', bg: 'bg-rose-500/10', icon: XCircle, label: 'REJECTED' };
    if (s === 'cancelled')
      return { color: 'text-zinc-500', bg: 'bg-zinc-500/10', icon: Ban, label: 'CANCELLED' };
    return { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock, label: 'PENDING' };
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter(o => {
    const s = o.status.toLowerCase();
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return s === 'open' || s === 'pending' || s === 'trigger pending';
    if (filter === 'COMPLETED') return s === 'complete' || s === 'completed';
    if (filter === 'REJECTED') return s === 'rejected' || s === 'cancelled';
    return true;
  });

  // ── Modify: open OrderWindow with existing values ──────────────────────────
  const handleModify = (order: Order) => {
    const cfg: OrderConfig = {
      side:         order.type.toUpperCase() as 'BUY' | 'SELL',
      symbol:       order.symbol,
      price:        order.average_price > 0 ? order.average_price : order.price,
      defaultQty:   order.quantity,
      defaultProduct: (order.product.toUpperCase() === 'MIS' ? 'MIS' : 'NRML') as any,
      // Pass flags so OrderWindow knows this is a modify
      _isModify:    true,
      _orderId:     order.order_id,
      _orderType:   order.order_type as any,
      _validity:    (order.validity ?? 'DAY') as any,
      _triggerPrice: order.trigger_price ?? 0,
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
      {/* ── Modify OrderWindow overlay ── */}
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
            <h1 className="text-lg font-black tracking-tight">Orders</h1>
          </div>
          <button
            onClick={() => { setLoading(true); fetchOrders(); }}
            className={cn('p-2 rounded-xl bg-zinc-900 text-zinc-400', loading && 'animate-spin')}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="px-6 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {(['ALL', 'OPEN', 'COMPLETED', 'REJECTED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase whitespace-nowrap transition-all',
                  filter === f ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Order list ── */}
        <div className="px-6 space-y-4">
          {loading && orders.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm font-bold uppercase tracking-widest">
              Loading Orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm font-bold uppercase tracking-widest">
              No Orders Found
            </div>
          ) : (
            filteredOrders.map((order, i) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              const canModify = isModifiable(order.status);
              const canCancel = isCancellable(order.status);
              const isConfirmingCancel = cancelConfirmId === order.order_id;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={order.order_id}
                  className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4"
                >
                  {/* ── Top row ── */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded pl-1 font-black uppercase tracking-widest',
                          order.type.toUpperCase() === 'BUY'
                            ? 'text-emerald-500 bg-emerald-500/10'
                            : 'text-rose-500 bg-rose-500/10'
                        )}>
                          {order.type}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          {order.product} • {order.order_type}
                        </span>
                      </div>
                      <h3 className="text-sm font-black">{order.symbol}</h3>
                    </div>
                    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg', statusConfig.bg, statusConfig.color)}>
                      <StatusIcon size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* ── Stats row ── */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-800/50">
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Qty</p>
                      <p className="text-xs font-bold">{order.filled_quantity}/{order.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Price</p>
                      <p className="text-xs font-bold">
                        {order.average_price > 0 ? formatCurrency(order.average_price) : formatCurrency(order.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Time</p>
                      <p className="text-xs font-bold text-zinc-400">
                        {new Date(order.placed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* ── Modified timestamp (if modified) ── */}
                  {order.modified_at && (
                    <p className="text-[9px] text-zinc-600 mt-2 font-medium">
                      Modified: {new Date(order.modified_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  {/* ── Action buttons: only for OPEN/PENDING orders ── */}
                  {(canModify || canCancel) && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/50">
                      {/* Cancel confirm inline warning */}
                      <AnimatePresence>
                        {isConfirmingCancel && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-3"
                          >
                            <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-rose-400">Cancel this order?</p>
                              <p className="text-[9px] text-zinc-500 mt-0.5">
                                {order.symbol} · {order.type} · {order.quantity} qty
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-2">
                        {/* Modify button */}
                        {canModify && !isConfirmingCancel && (
                          <button
                            onClick={() => handleModify(order)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                          >
                            <Pencil size={12} />
                            Modify
                          </button>
                        )}

                        {/* Cancel / Confirm cancel */}
                        {canCancel && (
                          <>
                            {isConfirmingCancel ? (
                              <div className="flex gap-2 flex-1">
                                <button
                                  onClick={() => setCancelConfirmId(null)}
                                  className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                  Keep
                                </button>
                                <button
                                  onClick={() => handleCancelConfirm(order.order_id)}
                                  disabled={cancelLoading}
                                  className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                >
                                  {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setCancelConfirmId(order.order_id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                              >
                                <CancelIcon size={12} />
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default Orders;