import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, Layers, ChevronDown, Zap, MousePointer2, Activity, BarChart3, Target, ArrowRightLeft, XCircle, ShieldCheck } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import OptionChain from '../components/OptionChain';
import { useAuthStore } from '../store/authStore';
import { F_O_INDICES } from '../constants/marketData';
import { toast } from 'sonner';
import Sparkline from '../components/Sparkline';
import FullChartModal from '../components/FullChartModal';
import { apiClient } from '../api/client'; // <-- ADDED IMPORT

const FOTradingCenter = ({ 
  stocks, 
  onOpenOptionChain,
  onConnectAngel,
  onConnectUptox,
  isConnectingAngel,
  isConnectingUptox
}: { 
  stocks: Record<string, number>, 
  onOpenOptionChain: () => void,
  onConnectAngel: () => void,
  onConnectUptox: () => void,
  isConnectingAngel: boolean,
  isConnectingUptox: boolean
}) => {
  const { user } = useAuthStore();
  const [isScalperMode, setIsScalperMode] = useState(false);
  const [activeChart, setActiveChart] = useState<any>(null);
  const [confirmExit, setConfirmExit] = useState<number | null>(null);
  const [slTgtModal, setSlTgtModal] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We still check for the token's presence, but we don't need to pass it manually
    // because apiClient handles the Authorization headers automatically.
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const fetchPositions = async () => {
      try {
        // Switched to apiClient to handle automatic token refreshing and 403s
        const res = await apiClient.get('/api/portfolio/positions');
        
        const data = res.data;
        setPositions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch positions', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExit = async (index: number) => {
    const pos = positions[index];
    if (isScalperMode || confirmExit === index) {
      toast.info(`Placing exit order for ${pos.symbol}...`);
      // In a real app, we'd call /api/orders with the opposite side
      setPositions(positions.filter((_, i) => i !== index));
      setConfirmExit(null);
    } else {
      setConfirmExit(index);
      setTimeout(() => setConfirmExit(null), 3000);
    }
  };

  const [orders, setOrders] = useState<any[]>([
    { symbol: 'FINNIFTY 20500 CE', quantity: 40, price: 12.50, status: 'Pending', type: 'Buy' },
  ]);

  const totalPnL = positions.reduce((acc, pos) => {
    return acc + (pos.ltp - pos.avgPrice) * pos.quantity;
  }, 0);

  const margins = [
    { label: 'Available', value: 1250000, color: 'text-emerald-500' },
    { label: 'Used', value: 450000, color: 'text-rose-500' },
    { label: 'Exposure', value: 180000, color: 'text-blue-500' },
    { label: 'Span', value: 270000, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* Broker Connection for Users */}
      {!user?.is_angelone_connected && !user?.is_uptox_connected && user?.role !== 'user' && (
        <div className="px-4 pt-4">
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Connect Your Broker</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Link account to start F&O trading</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onConnectAngel}
                disabled={isConnectingAngel}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 px-4 flex flex-col items-center gap-2 transition-all disabled:opacity-50"
              >
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Angel One</span>
                <span className="text-[8px] font-bold text-emerald-500 uppercase">Link Now</span>
              </button>
              <button 
                onClick={onConnectUptox}
                disabled={isConnectingUptox}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 px-4 flex flex-col items-center gap-2 transition-all disabled:opacity-50"
              >
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Uptox</span>
                <span className="text-[8px] font-bold text-emerald-500 uppercase">Link Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Margin Panel */}
      <div className="px-4 pt-3">
        <div className="overflow-x-auto scrollbar-hide flex gap-2">
          {margins.map((m) => (
            <div key={m.label} className="min-w-30 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 space-y-0.5">
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{m.label} Margin</p>
              <p className={cn("text-[12px] font-black tracking-tight", m.color)}>{formatCurrency(m.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scalper Mode & Summary */}
      <div className="px-4">
        <div className="bg-linear-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center shadow-2xl">
          <div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Total Realized P&L</p>
            <h2 className={cn("text-xl font-black tracking-tighter", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button 
                onClick={() => setIsScalperMode(false)}
                className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all", !isScalperMode ? "bg-zinc-800 text-white" : "text-zinc-600")}
              >Normal</button>
              <button 
                onClick={() => setIsScalperMode(true)}
                className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1", isScalperMode ? "bg-emerald-500 text-black" : "text-zinc-600")}
              >
                <Zap size={10} />
                Scalper
              </button>
            </div>
            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Speed Mode</p>
          </div>
        </div>
      </div>

      {/* Live Positions with Swipe */}
      <div className="px-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Activity size={12} />
            Live Positions
          </h3>
          <span className="text-[8px] font-bold text-zinc-700">{positions.length} Active</span>
        </div>
        
        <div className="space-y-2.5">
          {positions.map((pos, i) => (
            <div key={pos.symbol} className="relative overflow-hidden rounded-xl group">
              {/* Action Panel (Revealed on Swipe) - Only for Admin */}
              {user?.role === 'admin' && (
                <div className="absolute inset-0 bg-zinc-900 flex justify-end items-stretch">
                  <div className="flex h-full">
                    <button 
                      onClick={() => setSlTgtModal({ index: i, ...pos })}
                      className="px-3 bg-blue-600 text-white flex flex-col items-center justify-center gap-1 transition-colors hover:bg-blue-700"
                    >
                      <Target size={12} />
                      <span className="text-[7px] font-black uppercase">SL/Tgt</span>
                    </button>
                    <button 
                      onClick={() => setActiveChart(pos)}
                      className="px-3 bg-zinc-800 text-white flex flex-col items-center justify-center gap-1 transition-colors hover:bg-zinc-700"
                    >
                      <BarChart3 size={12} />
                      <span className="text-[7px] font-black uppercase">Chart</span>
                    </button>
                    <button 
                      onClick={() => handleExit(i)}
                      className={cn(
                        "px-4 flex flex-col items-center justify-center gap-1 transition-all duration-300",
                        confirmExit === i ? "bg-rose-500 text-black scale-105" : "bg-rose-600 text-white hover:bg-rose-700"
                      )}
                    >
                      <XCircle size={14} />
                      <span className="text-[7px] font-black uppercase">{confirmExit === i ? 'Confirm' : 'Exit'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Position Card */}
              <motion.div 
                drag={user?.role === 'admin' ? "x" : false}
                dragConstraints={{ left: -150, right: 0 }}
                dragElastic={0.1}
                className={cn(
                  "relative bg-zinc-900/60 border border-zinc-800/50 p-3.5 space-y-2.5 z-10",
                  user?.role === 'admin' ? "cursor-grab active:cursor-grabbing" : ""
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-black text-white tracking-tight">{pos.symbol}</p>
                      <span className={cn(
                        "px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter",
                        pos.type === 'Intraday' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                      )}>{pos.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase">{pos.quantity} Qty</p>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <p className="text-[8px] font-bold text-zinc-500 uppercase">Avg {formatCurrency(pos.avgPrice)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Sparkline color={pos.change >= 0 ? '#10b981' : '#ef4444'} />
                      <p className={cn("text-sm font-black tracking-tighter", (pos.ltp - pos.avgPrice) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {formatCurrency((pos.ltp - pos.avgPrice) * pos.quantity)}
                      </p>
                    </div>
                    <p className="text-[8px] font-bold text-zinc-500 mt-0.5">
                      LTP: <span className="text-white">{formatCurrency(pos.ltp)}</span>
                      <span className={cn("ml-1", pos.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        ({pos.change >= 0 ? '+' : ''}{pos.change}%)
                      </span>
                    </p>
                  </div>
                </div>

                {/* Risk Management Indicators */}
                <div className="flex gap-2.5 pt-2 border-t border-zinc-800/50">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-rose-500/40" />
                    <span className="text-[8px] font-bold text-zinc-600 uppercase">SL: {formatCurrency(pos.avgPrice * 0.95)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                    <span className="text-[8px] font-bold text-zinc-600 uppercase">Tgt: {formatCurrency(pos.avgPrice * 1.15)}</span>
                  </div>
                </div>

                {/* Visible Exit Button for Users */}
                {user?.role === 'user' && (
                  <div className="pt-2">
                    <button 
                      onClick={() => handleExit(i)}
                      className={cn(
                        "w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                        confirmExit === i ? "bg-rose-500 text-black" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      )}
                    >
                      {confirmExit === i ? 'Confirm Exit' : 'Exit Position'}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* GTT & Risk Controls */}
      <div className="px-4 space-y-2.5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <ShieldCheck size={12} />
          Risk Management
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl flex flex-col items-center gap-1 hover:bg-zinc-900/50 transition-all">
            <Target size={16} className="text-blue-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Set GTT</span>
          </button>
          <button className="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl flex flex-col items-center gap-1 hover:bg-zinc-900/50 transition-all">
            <Layers size={16} className="text-amber-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Trailing SL</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeChart && (
          <FullChartModal 
            key="full-chart-modal"
            instrument={activeChart} 
            onClose={() => setActiveChart(null)} 
          />
        )}
        {slTgtModal && (
          <motion.div 
            key="sl-tgt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-120 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black tracking-tight text-white">Set SL & Target</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{slTgtModal.symbol}</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Stop Loss</label>
                  <input type="number" defaultValue={slTgtModal.avgPrice * 0.95} className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-rose-500/50 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Target</label>
                  <input type="number" defaultValue={slTgtModal.avgPrice * 1.15} className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setSlTgtModal(null)} className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl uppercase text-[10px] tracking-widest">Cancel</button>
                <button onClick={() => setSlTgtModal(null)} className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Update</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FOTradingCenter;