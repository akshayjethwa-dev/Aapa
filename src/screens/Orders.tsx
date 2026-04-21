import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, RefreshCw, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

interface Order {
  order_id: string;
  symbol: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  average_price: number;
  status: string;
  type: string;
  order_type: string;
  product: string;
  placed_at: string;
  broker: string;
}

// 1. ADD THE PROP TYPE HERE
const Orders = ({ onBack }: { onBack: () => void }) => {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED' | 'REJECTED'>('ALL');

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Poll every 8 seconds
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const getStatusConfig = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'complete' || s === 'completed') return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2, label: 'EXECUTED' };
    if (s === 'rejected') return { color: 'text-rose-500', bg: 'bg-rose-500/10', icon: XCircle, label: 'REJECTED' };
    if (s === 'cancelled') return { color: 'text-zinc-500', bg: 'bg-zinc-500/10', icon: Ban, label: 'CANCELLED' };
    return { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock, label: 'PENDING' };
  };

  const filteredOrders = orders.filter(o => {
    const s = o.status.toLowerCase();
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return s === 'open' || s === 'pending';
    if (filter === 'COMPLETED') return s === 'complete' || s === 'completed';
    if (filter === 'REJECTED') return s === 'rejected' || s === 'cancelled';
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 2. USE THE onBack PROP HERE */}
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-zinc-900 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight">Orders</h1>
        </div>
        <button onClick={() => { setLoading(true); fetchOrders(); }} className={cn("p-2 rounded-xl bg-zinc-900 text-zinc-400", loading && "animate-spin")}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="px-6 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['ALL', 'OPEN', 'COMPLETED', 'REJECTED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase whitespace-nowrap transition-all",
                filter === f ? "bg-white text-black" : "bg-zinc-900 text-zinc-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 space-y-4">
        {loading && orders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading Orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm font-bold uppercase tracking-widest">No Orders Found</div>
        ) : (
          filteredOrders.map((order, i) => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                key={order.order_id} 
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded pl-1 font-black uppercase tracking-widest", order.type.toUpperCase() === 'BUY' ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10")}>
                        {order.type}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{order.product} • {order.order_type}</span>
                    </div>
                    <h3 className="text-sm font-black">{order.symbol}</h3>
                  </div>
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg", statusConfig.bg, statusConfig.color)}>
                    <StatusIcon size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{statusConfig.label}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-800/50">
                  <div>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Qty</p>
                    <p className="text-xs font-bold">{order.filled_quantity}/{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Price</p>
                    <p className="text-xs font-bold">{order.average_price > 0 ? formatCurrency(order.average_price) : formatCurrency(order.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Time</p>
                    <p className="text-xs font-bold text-zinc-400">
                      {new Date(order.placed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Orders;