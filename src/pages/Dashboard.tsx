import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { cn, formatCurrency } from '../lib/utils';

// Shared Sparkline Component
const Sparkline = ({ color = '#10b981' }: { color?: string }) => (
  <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 23L10 15L20 18L30 8L40 12L50 2L59 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface DashboardProps {
  stocks: Record<string, number>;
}

export default function Dashboard({ stocks }: DashboardProps) {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        // Using apiClient to automatically handle tokens and JSON parsing
        const [hRes, pRes] = await Promise.all([
          apiClient.get('/api/portfolio/holdings').catch(() => ({ data: [] })),
          apiClient.get('/api/portfolio/positions').catch(() => ({ data: [] }))
        ]);
        
        if (hRes.data?.status === 'success') setHoldings(hRes.data.data);
        else if (Array.isArray(hRes.data)) setHoldings(hRes.data);

        const pData = pRes.data;
        setPositions(Array.isArray(pData) ? pData : (pData.status === 'success' ? pData.data : []));
      } catch (e) {
        console.error("Failed to fetch portfolio", e);
      }
    };

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalInvested = holdings.reduce((acc, curr) => acc + (curr.quantity * curr.average_price), 0);
  const currentValue = holdings.reduce((acc, curr) => acc + (curr.quantity * (stocks[curr.trading_symbol] || curr.last_price || curr.average_price)), 0);
  const totalPnL = currentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const isDataLive = (stocks['NIFTY 50'] || 0) > 0;

  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];

  const sortedGainersLosers = useMemo(() => {
    return Object.entries(stocks)
      .filter(([s]) => !primaryIndices.includes(s) && !secondaryIndices.includes(s))
      .map(([symbol, price]) => ({ symbol, price, change: 0 }))
      .slice(0, 5);
  }, [stocks]);

  return (
    <div className="space-y-5 pb-20">
      {/* Market Indices Section */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Indices</h3>
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-3 py-2">
          {[...primaryIndices, ...secondaryIndices].map(index => (
            <motion.div 
              key={index} 
              whileHover={{ y: -2 }}
              className="min-w-[150px] bg-zinc-900/40 border border-zinc-800/50 rounded-2xl pt-3 pb-4 px-4 flex flex-col gap-2 cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{index}</span>
                <Sparkline color={(stocks[index] || 0) > (index.includes('SENSEX') ? 70000 : 20000) ? '#10b981' : '#ef4444'} />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-white">
                  {(stocks[index] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold", 
                    (stocks[index] || 0) > (index.includes('SENSEX') ? 70000 : 20000) ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                    {(stocks[index] || 0) > (index.includes('SENSEX') ? 70000 : 20000) ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    <span>+1.24%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Portfolio Snapshot */}
      <div className="px-5">
        {(!user?.is_uptox_connected && user?.role !== 'user') ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <Zap className="text-emerald-500" size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">Connect Broker</h4>
              <p className="text-[10px] text-zinc-500 font-medium">Link your broker account to see live prices.</p>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total P&L</p>
                <p className={cn("text-lg font-bold", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)} ({totalPnLPercent.toFixed(2)}%)
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isDataLive ? "bg-emerald-500" : "bg-rose-500")} />
                  <p className={cn("text-[9px] font-bold uppercase tracking-widest", isDataLive ? "text-emerald-500" : "text-rose-500")}>
                    {isDataLive ? "Live" : "Connecting..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gainers and Losers */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Movers</h3>
        </div>
        <div className="space-y-2">
          {sortedGainersLosers.map(({ symbol, price }) => (
            <div key={symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                  {symbol.substring(0, 2)}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}