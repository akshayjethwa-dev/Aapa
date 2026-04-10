import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from './TradingViewWidget';


const FullChartModal = ({ instrument, onClose }: { instrument: any, onClose: () => void }) => {
  const [timeframe, setTimeframe] = useState('5m');
  const [price, setPrice] = useState(instrument.ltp);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev: number) => prev + (Math.random() - 0.5) * 2);
    }, 2000); // Reduced frequency to prevent excessive re-renders
    return () => clearInterval(interval);
  }, []);

  // Mock data for candlestick
  const chartData = Array.from({ length: 40 }).map((_, i) => {
    const base = instrument.ltp + Math.sin(i / 5) * 20;
    return {
      time: i,
      open: base,
      high: base + Math.random() * 5,
      low: base - Math.random() * 5,
      close: base + (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 1000),
      ema: base + 2,
      vwap: base - 1
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-100 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">{instrument.symbol}</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Chart • {timeframe}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-black tracking-tighter", price >= instrument.avgPrice ? "text-emerald-500" : "text-rose-500")}>
            {formatCurrency(price)}
          </p>
          <p className="text-[10px] font-bold text-zinc-500">{(Math.random() * 2).toFixed(2)}%</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-zinc-900 flex justify-between items-center overflow-x-auto scrollbar-hide gap-4">
        <div className="flex gap-1">
          {['1m', '5m', '15m', '1h', '1D'].map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                timeframe === tf ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[8px] font-black text-blue-500 uppercase">EMA</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[8px] font-black text-amber-500 uppercase">VWAP</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        <ErrorBoundary>
          <TradingViewWidget symbol={instrument.symbol} />
        </ErrorBoundary>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
        <button className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10 uppercase text-xs tracking-widest">SELL</button>
        <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10 uppercase text-xs tracking-widest">BUY</button>
      </div>
    </motion.div>
  );
};

export default FullChartModal;