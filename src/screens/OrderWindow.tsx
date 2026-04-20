import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

export interface OrderConfig {
  side: 'BUY' | 'SELL';
  symbol: string;      
  strike?: number;     
  optionType?: 'CE' | 'PE';
  expiry?: string;     
  price: number;       
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

  // Clean format for the UI (e.g. "NIFTY 22500 CE" or just "RELIANCE")
  const displaySymbol = config.strike 
    ? `${config.symbol.replace(' 50', '')} ${config.strike} ${config.optionType}`
    : config.symbol.replace(' 50', '');

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // NEW: Sending strict structured payload to backend
        body: JSON.stringify({
          broker: 'upstox',
          symbol: config.symbol, 
          type: config.side.toLowerCase(),
          order_type: orderType.toLowerCase(),
          quantity: parseInt(quantity.toString()),
          price: orderType === 'Market' ? config.price : parseFloat(price.toString()),
          product: product.toLowerCase(),
          expiry: config.expiry,
          strike: config.strike,
          optionType: config.optionType
        })
      });
      
      const data = await res.json();

      if (res.status === 403 && data.requires_kyc) {
        onClose(); 
        if (onKycRequired) onKycRequired(); 
        toast.error(data.message || 'KYC required to trade.');
        return;
      }

      if (res.status === 403 && data.requires_upstox) {
        onClose();
        toast.error(
          <div className="flex flex-col gap-2">
            <span className="font-bold text-rose-500">Action Required</span>
            <span className="text-xs">{data.message}</span>
            <a href="https://upstox.com/open-demat-account/" target="_blank" rel="noopener noreferrer" className="mt-2 bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-black uppercase text-center w-full">Open Account Now</a>
          </div>,
          { duration: 6000 }
        );
        return;
      }

      if (data.success) {
        onOrderPlaced();
        onClose();
        toast.success(`Order placed successfully via Upstox!`);
      } else {
        toast.error(data.error || 'Order failed');
      }
    } catch (e) {
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

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
              {config.side} {displaySymbol}
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
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Executing Broker</p>
          {user?.is_uptox_connected ? (
            <div className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 border-emerald-500 text-emerald-500 text-center">
              Upstox Connected
            </div>
          ) : (
            <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">No Broker Connected</p>
              <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">Connect Upstox in the 'More' tab to trade</p>
            </div>
          )}
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
              <p className="text-xs font-bold text-white">{new Date(config.expiry!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
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
      </div>

      <div className="p-6 bg-black border-t border-zinc-900">
        <button 
          onClick={handlePlaceOrder}
          disabled={loading || !user?.is_uptox_connected || isDemoMode}
          className={cn(
            "w-full font-black py-5 rounded-2xl transition-all shadow-xl uppercase text-xs tracking-widest",
            config.side === 'BUY' ? "bg-emerald-500 text-black shadow-emerald-500/10" : "bg-rose-500 text-black shadow-rose-500/10",
            (loading || !user?.is_uptox_connected || isDemoMode) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? 'Processing...' : isDemoMode ? 'Disabled in Demo Mode' : `${config.side} ${displaySymbol}`}
        </button>
      </div>
    </motion.div>
  );
};

export default OrderWindow;