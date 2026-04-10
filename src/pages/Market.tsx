import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowUpRight, ArrowDownRight, Plus, Activity, FileText, TrendingUp, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client';
import { cn, formatCurrency } from '../lib/utils';
import OptionChain from '../components/OptionChain';

interface MarketProps {
  stocks: Record<string, number>;
  onIndexClick: (index: string) => void;
  onPlaceOrder: (config: any) => void;
  initialSelectedStock?: string | null;
}

export default function Market({ stocks, onIndexClick, onPlaceOrder, initialSelectedStock }: MarketProps) {
  const [activeSegment, setActiveSegment] = useState('Watchlist');
  const [selectedStock, setSelectedStock] = useState<string | null>(initialSelectedStock || null);
  const [watchlist, setWatchlist] = useState<string[]>(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']);

  useEffect(() => {
    if (initialSelectedStock) {
      setSelectedStock(initialSelectedStock);
    }
  }, [initialSelectedStock]);

  const segments = ['Watchlist', 'Orders', 'Positions', 'F&O'];
  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];

  const toggleWatchlist = (symbol: string) => {
    if (watchlist.includes(symbol)) {
      setWatchlist(watchlist.filter(s => s !== symbol));
    } else {
      setWatchlist([...watchlist, symbol]);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Segmented Tabs */}
      <div className="px-4 pt-1.5">
        <div className="bg-zinc-900/50 p-1 rounded-xl flex gap-1 border border-zinc-800/50">
          {segments.map(segment => (
            <button
              key={segment}
              onClick={() => setActiveSegment(segment)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                activeSegment === segment ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {segment}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {activeSegment === 'Watchlist' && (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input type="text" placeholder="Search stocks..." className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-[13px] focus:outline-none focus:border-emerald-500/50 transition-colors" />
            </div>
            
            <div className="overflow-x-auto scrollbar-hide flex gap-2.5 py-1">
              {primaryIndices.map(index => (
                <button key={index} onClick={() => onIndexClick(index)} className="px-3.5 py-1.5 bg-zinc-900/40 border border-zinc-800/50 rounded-xl whitespace-nowrap">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{index}</p>
                  <p className="text-[11px] font-bold text-white">{(stocks[index] || 0).toLocaleString('en-IN')}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {Object.entries(stocks)
                .filter(([s]) => !primaryIndices.includes(s) && !secondaryIndices.includes(s))
                .map(([symbol, price]) => (
                <motion.div layout key={symbol} onClick={() => setSelectedStock(symbol)} className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                      {symbol.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white tracking-tight">{symbol}</p>
                      <p className="text-[9px] font-bold text-zinc-600 uppercase">NSE</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-white">{formatCurrency(price)}</p>
                    <p className="text-[9px] font-bold text-emerald-500">+{(Math.random() * 2).toFixed(2)}%</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {activeSegment === 'Orders' && (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
            <FileText className="mx-auto text-zinc-800 mb-2.5" size={32} />
            <p className="text-[13px] font-bold text-zinc-500">No Active Orders</p>
          </div>
        )}

        {activeSegment === 'Positions' && (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
            <TrendingUp className="mx-auto text-zinc-800 mb-2.5" size={32} />
            <p className="text-[13px] font-bold text-zinc-500">No Open Positions</p>
          </div>
        )}

        {activeSegment === 'F&O' && (
          <OptionChain onPlaceOrder={onPlaceOrder} stocks={stocks} fullChain={true} />
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedStock && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[60] bg-black p-6 flex flex-col">
             <div className="flex justify-between items-center mb-8">
              <button onClick={() => setSelectedStock(null)} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <h2 className="text-lg font-bold tracking-tight">{selectedStock}</h2>
              <button onClick={() => toggleWatchlist(selectedStock)} className={cn("p-3 rounded-2xl transition-all", watchlist.includes(selectedStock) ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400")}>
                <Plus size={24} className={cn(watchlist.includes(selectedStock) && "rotate-45")} />
              </button>
            </div>
            
            <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">
              <div className="text-center">
                <p className="text-5xl font-bold tracking-tighter mb-2">{formatCurrency(stocks[selectedStock] || 0)}</p>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
              <button onClick={() => onPlaceOrder({ side: 'SELL', symbol: selectedStock, price: stocks[selectedStock] })} className="flex-1 bg-rose-500 text-black font-bold py-5 rounded-2xl">SELL</button>
              <button onClick={() => onPlaceOrder({ side: 'BUY', symbol: selectedStock, price: stocks[selectedStock] })} className="flex-1 bg-emerald-500 text-black font-bold py-5 rounded-2xl">BUY</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}