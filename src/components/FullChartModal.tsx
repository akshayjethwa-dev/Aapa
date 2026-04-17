import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingTerminal from './TradingTerminal';
import ErrorBoundary from './ErrorBoundary';

const FullChartModal = ({ instrument, onClose }: { instrument: any, onClose: () => void }) => {
  const [timeframe, setTimeframe] = useState('5m');
  // Initialize with the prop LTP, but update when the WebSocket pushes new data
  const [livePrice, setLivePrice] = useState(instrument.ltp); 

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
          <p className={cn("text-lg font-black tracking-tighter", livePrice >= instrument.ltp ? "text-emerald-500" : "text-rose-500")}>
            {formatCurrency(livePrice)}
          </p>
          <p className="text-[10px] font-bold text-zinc-500">Live</p>
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
      </div>

      {/* Chart Area - Now using Real Data via TradingTerminal */}
      <div className="flex-1 relative bg-black">
        <ErrorBoundary>
          <TradingTerminal 
            instrumentKey={instrument.symbol} 
            onPriceUpdate={(newPrice) => setLivePrice(newPrice)} 
          />
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