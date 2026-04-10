import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Target } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const AISignals = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/ai/signals', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSignals(data);
        }
      } catch (e) {
        console.error("Failed to fetch AI signals", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, [token]);

  if (loading) return (
    <div className="p-6 bg-zinc-900/20 border border-zinc-800/30 rounded-2xl animate-pulse flex items-center justify-center">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Generating AI Signals...</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">AI Trading Signals</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {signals.map((signal, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap size={40} className={signal.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                  signal.side === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"
                )}>
                  {signal.side}
                </span>
                <h4 className="text-sm font-black text-white tracking-tight">{signal.symbol}</h4>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium leading-tight max-w-50">{signal.reason}</p>
            </div>
            <div className="text-right space-y-1 relative z-10">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Target</p>
              <p className="text-sm font-black text-emerald-500">{formatCurrency(signal.target)}</p>
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">SL: {formatCurrency(signal.stoploss)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AISignals;