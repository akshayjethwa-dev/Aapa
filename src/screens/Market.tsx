import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ArrowUpRight, ArrowDownRight, TrendingUp, Activity, Newspaper, Calendar, Zap, ChevronRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import Sparkline from '../components/Sparkline';
import { INDEX_CONSTITUENTS, F_O_INDICES } from '../constants/marketData';

const Market = ({ stocks, onIndexClick, onPlaceOrder, initialSelectedStock }: { 
  stocks: Record<string, number>, 
  onIndexClick: (index: string) => void,
  onPlaceOrder: (config: any) => void,
  initialSelectedStock?: string | null
}) => {
  const [activeSegment, setActiveSegment] = useState('Watchlist');
  const [selectedStock, setSelectedStock] = useState<string | null>(initialSelectedStock || null);
  const [watchlist, setWatchlist] = useState<string[]>(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']);

  useEffect(() => {
    if (initialSelectedStock) {
      handleStockClick(initialSelectedStock);
    }
  }, [initialSelectedStock]);

  const segments = ['Watchlist', 'Orders', 'Positions', 'F&O'];

  const handleStockClick = async (symbol: string) => {
    setSelectedStock(symbol);
  };

  const toggleWatchlist = (symbol: string) => {
    if (watchlist.includes(symbol)) {
      setWatchlist(watchlist.filter(s => s !== symbol));
    } else {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];

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
              <input 
                type="text" 
                placeholder="Search stocks..." 
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-[13px] focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            
            {/* Indices Quick View */}
            <div className="overflow-x-auto scrollbar-hide flex gap-2.5 py-1">
              {primaryIndices.map(index => (
                <button 
                  key={index}
                  onClick={() => onIndexClick(index)}
                  className="px-3.5 py-1.5 bg-zinc-900/40 border border-zinc-800/50 rounded-xl whitespace-nowrap"
                >
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{index}</p>
                  <p className="text-[11px] font-bold text-white">{stocks[index]?.toLocaleString('en-IN')}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-1.5">
                <button className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-bold border border-emerald-500/20 uppercase">Gainers</button>
                <button className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 text-[9px] font-bold border border-rose-500/20 uppercase">Losers</button>
              </div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase">Sort by %</p>
            </div>

            <div className="space-y-2">
              {Object.entries(stocks)
                .filter(([s]) => !primaryIndices.includes(s) && !secondaryIndices.includes(s))
                .map(([symbol, price]) => (
                <motion.div 
                  layout
                  key={symbol} 
                  onClick={() => handleStockClick(symbol)}
                  className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center transition-all cursor-pointer"
                >
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
          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Active Orders</h4>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400">0</span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
              <FileText className="mx-auto text-zinc-800 mb-2.5" size={32} />
              <p className="text-[13px] font-bold text-zinc-500">No Active Orders</p>
              <p className="text-[10px] text-zinc-700 mt-0.5">Your pending orders will appear here</p>
            </div>
            
            <div className="pt-2 space-y-2.5">
              <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-1">Order History</h4>
              {[1,2].map(i => (
                <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <ArrowUpRight size={14} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white">RELIANCE Buy</p>
                      <p className="text-[8px] font-bold text-zinc-600 uppercase">Completed • 28 Feb</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[8px] font-bold text-emerald-500 uppercase">Filled</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSegment === 'Positions' && (
          <div className="space-y-2.5">
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
              {['Intraday', 'Delivery'].map(tab => (
                <button key={tab} className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-all">
                  {tab}
                </button>
              ))}
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
              <TrendingUp className="mx-auto text-zinc-800 mb-2.5" size={32} />
              <p className="text-[13px] font-bold text-zinc-500">No Open Positions</p>
              <p className="text-[10px] text-zinc-700 mt-0.5">Live P&L updates will be shown here</p>
            </div>
          </div>
        )}

        {activeSegment === 'F&O' && (
          <div className="space-y-4">
            <OptionChain onPlaceOrder={onPlaceOrder} stocks={stocks} fullChain={true} />
          </div>
        )}
      </div>

      {/* Stock Detail Modal */}
      <AnimatePresence mode="wait">
        {selectedStock && (
          <motion.div 
            key="stock-detail-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-60 bg-black p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <button onClick={() => setSelectedStock(null)} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-bold tracking-tight">{selectedStock}</h2>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">NSE • EQUITY</p>
              </div>
              <button 
                onClick={() => toggleWatchlist(selectedStock!)}
                className={cn(
                  "p-3 rounded-2xl transition-all",
                  watchlist.includes(selectedStock!) ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"
                )}
              >
                <Plus size={24} className={cn(watchlist.includes(selectedStock!) && "rotate-45")} />
              </button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">
              <div className="text-center">
                <p className="text-5xl font-bold tracking-tighter mb-2">{formatCurrency(stocks[selectedStock])}</p>
                <p className="text-sm font-bold text-emerald-500">+₹12.45 (0.85%) Today</p>
              </div>

              <div className="h-80 bg-zinc-900/50 rounded-4xl border border-zinc-800/50 relative overflow-hidden">
                <ErrorBoundary>
                  <TradingViewWidget symbol={selectedStock} />
                </ErrorBoundary>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Activity size={18} />
                  <h4 className="text-xs font-bold uppercase tracking-widest">Technical Overview</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">RSI (14)</p>
                    <p className="text-sm font-bold text-white">58.42 <span className="text-[10px] text-zinc-500 font-medium ml-1">Neutral</span></p>
                  </div>
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">MACD</p>
                    <p className="text-sm font-bold text-emerald-500">Bullish <span className="text-[10px] text-zinc-500 font-medium ml-1">Crossover</span></p>
                  </div>
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">200 DMA</p>
                    <p className="text-sm font-bold text-white">{(stocks[selectedStock] * 0.92).toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">52W High</p>
                    <p className="text-sm font-bold text-white">{(stocks[selectedStock] * 1.15).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12 px-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Bid Price</p>
                  {[1,2,3,4,5].map(i => (
                    <div key={`bid-${i}`} className="flex justify-between text-xs font-bold">
                      <span className="text-emerald-500">{(stocks[selectedStock] - i * 0.5).toFixed(2)}</span>
                      <span className="text-zinc-600">{i * 250}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 text-right">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Ask Price</p>
                  {[1,2,3,4,5].map(i => (
                    <div key={`ask-${i}`} className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-600">{i * 180}</span>
                      <span className="text-rose-500">{(stocks[selectedStock] + i * 0.5).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
              <button 
                onClick={() => onPlaceOrder({
                  side: 'SELL',
                  symbol: selectedStock,
                  price: stocks[selectedStock!]
                })}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10"
              >
                SELL
              </button>
              <button 
                onClick={() => onPlaceOrder({
                  side: 'BUY',
                  symbol: selectedStock,
                  price: stocks[selectedStock!]
                })}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10"
              >
                BUY
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Market;