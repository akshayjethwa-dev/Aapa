import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Target, BarChart3, XCircle, ShieldCheck, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { formatCurrency, cn } from '../lib/utils';

export default function FOTradingCenter({ 
  onOpenOptionChain, onConnectAngel, onConnectUptox, isConnectingAngel, isConnectingUptox 
}: any) {
  const { user } = useAuthStore();
  const [positions, setPositions] = useState<any[]>([]);
  const [isScalperMode, setIsScalperMode] = useState(false);
  const [confirmExit, setConfirmExit] = useState<number | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await apiClient.get('/api/portfolio/positions');
        setPositions(Array.isArray(res.data) ? res.data : []);
      } catch (err) {}
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalPnL = positions.reduce((acc, pos) => acc + (pos.ltp - pos.avgPrice) * pos.quantity, 0);

  return (
    <div className="space-y-4 pb-24">
      {/* Scalper Mode & Summary */}
      <div className="px-4">
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center shadow-2xl">
          <div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Total Realized P&L</p>
            <h2 className={cn("text-xl font-black tracking-tighter", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button onClick={() => setIsScalperMode(false)} className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase", !isScalperMode ? "bg-zinc-800 text-white" : "text-zinc-600")}>Normal</button>
              <button onClick={() => setIsScalperMode(true)} className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1", isScalperMode ? "bg-emerald-500 text-black" : "text-zinc-600")}>
                <Zap size={10} /> Scalper
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2.5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Activity size={12} /> Live Positions
        </h3>
        
        <div className="space-y-2.5">
          {positions.map((pos, i) => (
            <div key={pos.symbol} className="bg-zinc-900/60 border border-zinc-800/50 p-3.5 rounded-xl space-y-2.5 z-10">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-black text-white tracking-tight">{pos.symbol}</p>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase">{pos.quantity} Qty • Avg {formatCurrency(pos.avgPrice)}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-black", (pos.ltp - pos.avgPrice) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {formatCurrency((pos.ltp - pos.avgPrice) * pos.quantity)}
                  </p>
                  <p className="text-[8px] font-bold text-zinc-500 mt-0.5">LTP: <span className="text-white">{formatCurrency(pos.ltp)}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}