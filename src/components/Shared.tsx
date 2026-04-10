import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, cn } from '../lib/utils';

export const Sparkline = ({ color = '#10b981' }: { color?: string }) => (
  <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 23L10 15L20 18L30 8L40 12L50 2L59 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error('[ErrorBoundary]', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6">
            <AlertTriangle className="text-rose-500" size={32} />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-2">Something went wrong</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto mb-8">
            The application encountered an unexpected error.
          </p>
          <button onClick={() => window.location.reload()} className="bg-emerald-500 text-black font-black py-4 px-8 rounded-2xl">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const TradingViewWidget = React.memo(({ symbol, height = "100%" }: { symbol: string, height?: string | number }) => {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!container.current) return;
    setLoading(true);
    const currentContainer = container.current;
    currentContainer.innerHTML = '';
    
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    currentContainer.appendChild(widgetContainer);
    
    const getTradingViewSymbol = (s: string) => {
      if (s.includes(':')) return s;
      if (s.includes(' CE') || s.includes(' PE')) {
        const parts = s.split(' ');
        const base = parts[0] === 'NIFTY' ? 'NIFTY' : parts[0] === 'BANKNIFTY' ? 'BANKNIFTY' : parts[0];
        return `NSE:${base}`; 
      }
      const mapping: Record<string, string> = {
        'NIFTY 50': 'NSE:NIFTY', 'BANKNIFTY': 'NSE:BANKNIFTY', 'FINNIFTY': 'NSE:CNXFINANCE',
        'MIDCAP NIFTY': 'NSE:NIFTY_MID_SELECT', 'SENSEX': 'BSE:SENSEX', 'NIFTY IT': 'NSE:CNXIT',
        'NIFTY AUTO': 'NSE:CNXAUTO', 'NIFTY PHARMA': 'NSE:CNXPHARMA', 'NIFTY METAL': 'NSE:CNXMETAL',
        'NIFTY FMCG': 'NSE:CNXFMCG', 'NIFTY REALTY': 'NSE:CNXREALTY'
      };
      return mapping[s] || `NSE:${s}`;
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol: getTradingViewSymbol(symbol), interval: "5", timezone: "Asia/Kolkata",
      theme: "dark", style: "1", locale: "en", enable_publishing: false, hide_top_toolbar: false,
      hide_legend: false, save_image: false, container_id: "tradingview_chart", allow_symbol_change: true,
      support_host: "https://www.tradingview.com"
    });
    
    const timeoutId = setTimeout(() => {
      if (currentContainer) {
        currentContainer.appendChild(script);
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (currentContainer) currentContainer.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container relative" ref={container} style={{ height, width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        </div>
      )}
    </div>
  );
});

export const OrderWindow = ({ config, onClose, onOrderPlaced }: { config: any, onClose: () => void, onOrderPlaced: () => void }) => {
  const { user } = useAuthStore();
  const [quantity, setQuantity] = useState(config.quantity || 1);
  const [orderType, setOrderType] = useState('Market');
  const [product, setProduct] = useState('Intraday');
  const [price, setPrice] = useState(config.price || 0);
  const [loading, setLoading] = useState(false);
  const [broker, setBroker] = useState(user?.is_uptox_connected ? 'uptox' : user?.is_angelone_connected ? 'angelone' : 'uptox');

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/orders', {
        broker,
        symbol: config.strike ? `${config.symbol} ${config.strike} ${config.optionType}` : config.symbol,
        type: config.side.toLowerCase(),
        order_type: orderType.toLowerCase(),
        quantity: parseInt(quantity),
        price: orderType === 'Market' ? config.price : parseFloat(price),
        product: product.toLowerCase()
      });
      if (res.data.success) {
        onOrderPlaced();
        onClose();
        toast.success(`Order placed successfully via ${broker}!`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const connectedBrokers = [
    { id: 'uptox', name: 'Uptox', connected: user?.is_uptox_connected },
    { id: 'angelone', name: 'Angel One', connected: user?.is_angelone_connected }
  ].filter(b => b.connected);

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[110] bg-black flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white">{config.side} {config.symbol.replace(' 50', '')}{config.strike ? ` ${config.strike} ${config.optionType}` : ''}</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">{config.expiry || 'Equity • NSE'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Select Broker</p>
          <div className="flex gap-2">
            {connectedBrokers.length > 0 ? (
              connectedBrokers.map(b => (
                <button key={b.id} onClick={() => setBroker(b.id)} className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase", broker === b.id ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-zinc-900/30 text-zinc-500")}>
                  {b.name}
                </button>
              ))
            ) : (
              <div className="w-full p-4 bg-rose-500/5 text-center text-[10px] text-rose-500 font-bold">No Broker Connected</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase">Price</label>
            <input type="number" disabled={orderType === 'Market'} value={orderType === 'Market' ? config.price : price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold disabled:opacity-50" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Order Type</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl">
            {['Market', 'Limit'].map(t => (
              <button key={t} onClick={() => setOrderType(t)} className={cn("flex-1 py-3 rounded-lg text-[10px] font-bold uppercase", orderType === t ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>{t}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Product</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl">
            {['Intraday', 'Delivery'].map(p => (
              <button key={p} onClick={() => setProduct(p)} className={cn("flex-1 py-3 rounded-lg text-[10px] font-bold uppercase", product === p ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 bg-black border-t border-zinc-900">
        <button onClick={handlePlaceOrder} disabled={loading || connectedBrokers.length === 0} className={cn("w-full font-black py-5 rounded-2xl text-xs uppercase", config.side === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-black", (loading || connectedBrokers.length === 0) && "opacity-50")}>
          {loading ? 'Processing...' : `${config.side} ${config.symbol}`}
        </button>
      </div>
    </motion.div>
  );
};

export const FullChartModal = ({ instrument, onClose }: { instrument: any, onClose: () => void }) => {
  const [timeframe, setTimeframe] = useState('5m');
  const [price, setPrice] = useState(instrument.ltp);

  useEffect(() => {
    const interval = setInterval(() => setPrice((prev: number) => prev + (Math.random() - 0.5) * 2), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400"><ChevronRight className="rotate-180" size={24} /></button>
          <div>
            <h2 className="text-sm font-black text-white">{instrument.symbol}</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Live Chart • {timeframe}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-black", price >= instrument.avgPrice ? "text-emerald-500" : "text-rose-500")}>{formatCurrency(price)}</p>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-zinc-900 flex gap-4">
        <div className="flex gap-1">
          {['1m', '5m', '15m', '1h', '1D'].map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase", timeframe === tf ? "bg-zinc-800 text-white" : "text-zinc-600")}>{tf}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        <ErrorBoundary><TradingViewWidget symbol={instrument.symbol} /></ErrorBoundary>
      </div>

      <div className="p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
        <button className="flex-1 bg-rose-500 text-black font-black py-5 rounded-2xl uppercase">SELL</button>
        <button className="flex-1 bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase">BUY</button>
      </div>
    </motion.div>
  );
};

export const AISignals = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await apiClient.get('/api/ai/signals');
        setSignals(res.data);
      } catch (e) {} finally { setLoading(false); }
    };
    fetchSignals();
  }, []);

  if (loading) return <div className="p-6 bg-zinc-900/20 rounded-2xl animate-pulse text-center text-[10px] text-zinc-500 font-bold uppercase">Generating AI Signals...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">AI Trading Signals</h3>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] font-bold text-emerald-500 uppercase">Live</span></div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {signals.map((signal, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={40} className={signal.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'} /></div>
            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", signal.side === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-white")}>{signal.side}</span>
                <h4 className="text-sm font-black text-white">{signal.symbol}</h4>
              </div>
              <p className="text-[10px] text-zinc-400 max-w-[200px]">{signal.reason}</p>
            </div>
            <div className="text-right space-y-1 relative z-10">
              <p className="text-[9px] font-bold text-zinc-500 uppercase">Target</p>
              <p className="text-sm font-black text-emerald-500">{formatCurrency(signal.target)}</p>
              <p className="text-[8px] font-bold text-zinc-600 uppercase">SL: {formatCurrency(signal.stoploss)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};