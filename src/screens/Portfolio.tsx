import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, History, ArrowRight, AlertCircle, BarChart3, Calendar, Plus, Minus, ArrowRightLeft, RefreshCw, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

const Portfolio = ({ stocks, onGoToPositions }: { stocks: Record<string, number>; onGoToPositions?: () => void }) => {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [availableFunds, setAvailableFunds] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/portfolio');
      const payload = res.data;
      
      setHoldings(payload.holdings || []);
      setPositions(payload.positions || []);
      if (payload.funds !== undefined) setAvailableFunds(payload.funds);
      
    } catch (err: any) {
      console.error('Failed to fetch portfolio', err);
      setError("Unable to load portfolio holdings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    window.addEventListener('broker_portfolio_updated', fetchPortfolio);
    return () => window.removeEventListener('broker_portfolio_updated', fetchPortfolio);
  }, [fetchPortfolio]);

  const displayFunds = availableFunds !== null ? availableFunds : (user?.balance || 0);

  // --- Real P&L Math Engine ---
  let totalInvested = 0;
  let currentValue = 0;
  let dayPnL = 0;

  // Process Holdings
  holdings.forEach(h => {
    const ltp = stocks[h.symbol] || h.current_price || h.average_price;
    const close = h.close_price || h.average_price; // Fallback to avg if close is missing
    
    totalInvested += (h.quantity * h.average_price);
    currentValue += (h.quantity * ltp);
    dayPnL += (ltp - close) * h.quantity;
  });

  // Process Positions (Intraday/F&O)
  positions.forEach(p => {
    const ltp = stocks[p.symbol] || p.current_price || p.average_price;
    const close = p.close_price || p.average_price;
    
    totalInvested += (p.quantity * p.average_price);
    currentValue += (p.quantity * ltp);
    dayPnL += (ltp - close) * p.quantity;
  });

  const totalPnL = currentValue - totalInvested;
  const overallReturnPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const allocationData = holdings.length > 0
    ? holdings.map(h => ({
        name: h.symbol,
        value: h.quantity * (stocks[h.symbol] || h.current_price || h.average_price)
      }))
    : [{ name: 'Cash', value: displayFunds }];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Error State Component
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 px-5">
        <AlertCircle size={48} className="text-rose-500/50" />
        <p className="text-zinc-400 text-sm">{error}</p>
        <button 
          onClick={fetchPortfolio}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 overflow-y-auto scroll-smooth">

      {/* ── Portfolio Summary ── */}
      <div className="px-5 pt-4">
        <div className="bg-linear-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Portfolio Value</p>
            <h2 className="text-3xl font-black tracking-tighter text-white">{formatCurrency(currentValue + displayFunds)}</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-5 border-t border-zinc-800/50">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Overall P&L</p>
              <p className={cn("text-[13px] font-bold", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                <span className="block text-[10px]">({overallReturnPercent.toFixed(2)}%)</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Day P&L</p>
              <p className={cn("text-[13px] font-bold", dayPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {dayPnL >= 0 ? '+' : ''}{formatCurrency(dayPnL)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Available Cash</p>
              <p className="text-[13px] font-bold text-white">
                {formatCurrency(displayFunds)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ... (Keep existing Analytics section here) ... */}

      {/* ── Active Positions (Intraday/F&O) ── */}
      {(!loading && positions.length > 0) && (
        <div className="px-5">
          <button
            onClick={onGoToPositions}
            className="w-full flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 hover:bg-amber-500/15 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Activity size={18} className="text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold text-white">
                  {positions.length} Active {positions.length === 1 ? 'Position' : 'Positions'}
                </p>
                <p className="text-[9px] font-bold text-amber-500/70 uppercase tracking-widest mt-0.5">
                  Tap to manage • Square off • Convert
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-amber-400" />
          </button>
        </div>
      )}

      {/* ── Equity Holdings ── */}
      <div className="px-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Long-term Holdings</h3>
          <span className="text-[9px] font-bold text-zinc-700">{holdings.length} Assets</span>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800" />
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-zinc-800 rounded" />
                    <div className="h-2 w-14 bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="space-y-2 items-end flex flex-col">
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                  <div className="h-2 w-10 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && holdings.length === 0 && positions.length === 0 && (
          <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-8 text-center space-y-2">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">No holdings found</p>
            <p className="text-[10px] text-zinc-700">Connect your broker account and your assets will appear here.</p>
          </div>
        )}

        {/* Holdings list */}
        <div className="space-y-2.5">
          {holdings.map(h => {
            const ltp = stocks[h.symbol] || h.current_price || h.average_price;
            const pnl = (ltp - h.average_price) * h.quantity;
            return (
              <div key={h.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                    {h.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white tracking-tight">{h.symbol}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">
                      {h.quantity} Qty • Avg {formatCurrency(h.average_price)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-white">{formatCurrency(h.quantity * ltp)}</p>
                  <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Portfolio;