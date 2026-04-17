import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap, AlertCircle, Target, XCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

// --- STORY B4: Formalized Data Contract ---
export interface OrderConfig {
  side: 'BUY' | 'SELL';
  symbol: string;      // e.g., "NIFTY 22500 CE" or "RELIANCE"
  strike?: number;     // e.g., 22500
  optionType?: 'CE' | 'PE';
  expiry?: string;     // e.g., "2024-04-18"
  price: number;       // e.g., 145.20
}

const OrderWindow = ({ 
  config, 
  onClose, 
  onOrderPlaced, 
  isDemoMode = false,
  onKycRequired 
}: { 
  config: OrderConfig, 
  onClose: () => void, 
  onOrderPlaced: () => void, 
  isDemoMode?: boolean,
  onKycRequired?: () => void 
}) => {
  const { user, token } = useAuthStore();
  const [quantity, setQuantity] = useState<number | string>(1);
  const [orderType, setOrderType] = useState('Market');
  const [product, setProduct] = useState('Intraday');
  const [price, setPrice] = useState<number | string>(config.price || 0);
  const [loading, setLoading] = useState(false);
  const [broker, setBroker] = useState(user?.is_uptox_connected ? 'uptox' : user?.is_angelone_connected ? 'angelone' : 'uptox');

  const handlePlaceOrder = async () => {
    if (isDemoMode) {
      toast.error('Trading is disabled in Demo Mode');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          broker,
          symbol: config.symbol, // Passes "NIFTY 22500 CE" directly
          type: config.side.toLowerCase(),
          order_type: orderType.toLowerCase(),
          quantity: parseInt(quantity.toString()),
          price: orderType === 'Market' ? config.price : parseFloat(price.toString()),
          product: product.toLowerCase(),
          expiry: config.expiry // Critical for backend Upstox translation
        })
      });
      const data = await res.json();

      if (res.status === 403 && data.requires_kyc) {
        onClose(); 
        if (onKycRequired) onKycRequired(); 
        toast.error(data.message || 'KYC required to trade.');
        return;
      }

      if (data.success) {
        onOrderPlaced();
        onClose();
        toast.success(`Order placed successfully via ${broker === 'uptox' ? 'Uptox' : 'Angel One'}!`);
      } else {
        toast.error(data.error || 'Order failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const connectedBrokers = [
    { id: 'uptox', name: 'Uptox', connected: user?.is_uptox_connected },
    { id: 'angelone', name: 'Angel One', connected: user?.is_angelone_connected }
  ].filter(b => b.connected);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-110 bg-black flex flex-col"
    >
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">
              {config.side} {config.symbol.replace(' 50', '')}
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {config.expiry || 'Equity • NSE'}
            </p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
          config.side === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {config.side}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        {/* Broker Selection */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Select Broker</p>
          <div className="flex gap-2">
            {connectedBrokers.length > 0 ? (
              connectedBrokers.map(b => (
                <button
                  key={b.id}
                  onClick={() => setBroker(b.id)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                    broker === b.id 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-900/30 border-zinc-800/50 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  {b.name}
                </button>
              ))
            ) : (
              <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">No Broker Connected</p>
                <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">Connect a broker in the 'More' tab to trade</p>
              </div>
            )}
          </div>
        </div>

        {config.strike && (
          <div className="grid grid-cols-3 gap-4 pb-6 border-b border-zinc-900">
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Strike</p>
              <p className="text-xs font-bold text-white">{config.strike}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Type</p>
              <p className="text-xs font-bold text-white">{config.optionType}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Expiry</p>
              <p className="text-xs font-bold text-white">{config.expiry}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Quantity</label>
            <input 
              type="number" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isDemoMode}
              className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Price</label>
            <input 
              type="number" 
              disabled={orderType === 'Market' || isDemoMode}
              value={orderType === 'Market' ? config.price : price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50" 
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Order Type</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Market', 'Limit'].map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                disabled={isDemoMode}
                className={cn(
                  "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  orderType === t ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500",
                  isDemoMode && "opacity-50 cursor-not-allowed"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Product</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Intraday', 'Delivery'].map(p => (
              <button
                key={p}
                onClick={() => setProduct(p)}
                disabled={isDemoMode}
                className={cn(
                  "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  product === p ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500",
                  isDemoMode && "opacity-50 cursor-not-allowed"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Approx Margin</p>
            <p className="text-sm font-bold text-white">{formatCurrency((Number(quantity) || 0) * (orderType === 'Market' ? config.price : Number(price) || 0))}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Available</p>
            <p className="text-sm font-bold text-emerald-500">₹1,25,000.00</p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-black border-t border-zinc-900">
        <button 
          onClick={handlePlaceOrder}
          disabled={loading || connectedBrokers.length === 0 || isDemoMode}
          className={cn(
            "w-full font-black py-5 rounded-2xl transition-all shadow-xl uppercase text-xs tracking-widest",
            config.side === 'BUY' ? "bg-emerald-500 text-black shadow-emerald-500/10" : "bg-rose-500 text-black shadow-rose-500/10",
            (loading || connectedBrokers.length === 0 || isDemoMode) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? 'Processing...' : isDemoMode ? 'Disabled in Demo Mode' : `${config.side} ${config.symbol.replace(' 50', '')}`}
        </button>
      </div>
    </motion.div>
  );
};

export default OrderWindow;