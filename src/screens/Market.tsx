import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ArrowUpRight, ArrowDownRight, TrendingUp, Activity, Newspaper, Calendar, Zap, ChevronRight, FileText, Plus } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import Sparkline from '../components/Sparkline';
import OptionChain from '../components/OptionChain';
import ErrorBoundary from '../components/ErrorBoundary';
import { INDEX_CONSTITUENTS, F_O_INDICES } from '../constants/marketData';
import { MarketQuote, MarketPhase } from '../types';
import MarketStatusPill from '../components/MarketStatusPill';
import { apiClient } from '../api/client'; 
import TradingTerminal from '../components/TradingTerminal';

const Market = ({ 
  stocks, 
  onIndexClick, 
  onPlaceOrder, 
  initialSelectedStock,
  marketPhase = 'CLOSED'
}: { 
  stocks: Record<string, MarketQuote | number | any>, 
  onIndexClick: (index: string) => void,
  onPlaceOrder: (config: any) => void,
  initialSelectedStock?: string | null,
  marketPhase?: MarketPhase
}) => {
  const [activeSegment, setActiveSegment] = useState('Watchlist');
  const [selectedStock, setSelectedStock] = useState<string | null>(initialSelectedStock || null);
  const [watchlist, setWatchlist] = useState<string[]>(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']);
  
  // --- NEW: State for Orders and Positions ---
  const [brokerOrders, setBrokerOrders] = useState<any[]>([]);
  const [brokerPositions, setBrokerPositions] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    if (initialSelectedStock) {
      handleStockClick(initialSelectedStock);
    }
  }, [initialSelectedStock]);

  // --- NEW: Fetch & Polling Logic for Orders/Positions ---
  useEffect(() => {
    let intervalId: any;

    const fetchBrokerData = async () => {
      if (activeSegment === 'Orders') {
        try {
          if (brokerOrders.length === 0) setIsFetchingData(true);
          const res = await apiClient.get('/api/orders');
          setBrokerOrders(res.data || []);
        } catch (err) {
          console.error("Failed to fetch live orders", err);
        } finally {
          setIsFetchingData(false);
        }
      } else if (activeSegment === 'Positions') {
        try {
          if (brokerPositions.length === 0) setIsFetchingData(true);
          const res = await apiClient.get('/api/positions');
          setBrokerPositions(res.data || []);
        } catch (err) {
          console.error("Failed to fetch live positions", err);
        } finally {
          setIsFetchingData(false);
        }
      }
    };

    fetchBrokerData();

    // Setup 5-second polling only if the user is looking at the tab
    if (activeSegment === 'Orders' || activeSegment === 'Positions') {
      intervalId = setInterval(fetchBrokerData, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSegment]);

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

  const optionChainStocks = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(stocks).forEach(([k, v]) => {
      map[k] = typeof v === 'number' ? v : (v?.ltp || 0);
    });
    return map;
  }, [stocks]);

  return (
    <div className="space-y-4 pb-20">
      {/* Segmented Tabs & Market Status */}
      <div className="px-4 pt-1.5 flex justify-between items-center gap-2">
        <div className="bg-zinc-900/50 p-1 rounded-xl flex gap-1 border border-zinc-800/50 flex-1">
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
        <MarketStatusPill phase={marketPhase} />
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
            
            <div className="overflow-x-auto scrollbar-hide flex gap-2.5 py-1">
              {primaryIndices.map(index => {
                const quote = stocks[index];
                const ltp = typeof quote === 'number' ? quote : (quote?.ltp || 0);
                const changePct = quote?.changePercent;
                const isPositive = changePct !== undefined && changePct >= 0;

                return (
                  <button 
                    key={index}
                    onClick={() => onIndexClick(index)}
                    className="px-3.5 py-1.5 bg-zinc-900/40 border border-zinc-800/50 rounded-xl whitespace-nowrap"
                  >
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{index}</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-[11px] font-bold text-white">{ltp.toLocaleString('en-IN')}</p>
                      {changePct !== undefined && (
                        <p className={cn("text-[8px] font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                          {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
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
                .map(([symbol, quote]) => {
                  const ltp = typeof quote === 'number' ? quote : (quote?.ltp || 0);
                  const changePct = quote?.changePercent;
                  const isPositive = changePct !== undefined && changePct >= 0;

                  return (
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
                        <p className="text-[13px] font-bold text-white">{formatCurrency(ltp)}</p>
                        {changePct !== undefined ? (
                          <p className={cn("text-[9px] font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                            {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                          </p>
                        ) : (
                          <p className="text-[9px] font-bold text-emerald-500">+{(Math.random() * 2).toFixed(2)}%</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          </>
        )}

        {/* --- DYNAMIC ORDERS TAB --- */}
        {activeSegment === 'Orders' && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Active & History</h4>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400">{brokerOrders.length}</span>
            </div>
            
            {isFetchingData && brokerOrders.length === 0 ? (
               <div className="text-center py-10 text-zinc-500 text-xs font-medium animate-pulse">Syncing with Broker...</div>
            ) : brokerOrders.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
                <FileText className="mx-auto text-zinc-800 mb-2.5" size={32} />
                <p className="text-[13px] font-bold text-zinc-500">No Orders Found</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Your pending and completed orders will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {brokerOrders.map((order, idx) => (
                  <div key={order.order_id || idx} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                       <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-[9px] font-bold px-1.5 py-0.5 rounded", 
                           order.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                         )}>
                           {order.type}
                         </span>
                         <p className="text-[13px] font-bold text-white tracking-tight">{order.symbol}</p>
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-1">Qty: {order.filled_quantity}/{order.quantity} • {order.order_type}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[13px] font-bold text-white">{formatCurrency(order.average_price || order.price)}</p>
                       <p className={cn(
                         "text-[9px] font-bold uppercase mt-1", 
                         (order.status.toLowerCase() === 'complete' || order.status.toLowerCase() === 'filled') ? "text-emerald-500" : 
                         (order.status.toLowerCase() === 'rejected' || order.status.toLowerCase() === 'cancelled') ? "text-rose-500" : 
                         "text-amber-500"
                       )}>
                         {order.status}
                       </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- DYNAMIC POSITIONS TAB --- */}
        {activeSegment === 'Positions' && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Open Positions</h4>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400">{brokerPositions.length}</span>
            </div>

            {isFetchingData && brokerPositions.length === 0 ? (
               <div className="text-center py-10 text-zinc-500 text-xs font-medium animate-pulse">Fetching positions...</div>
            ) : brokerPositions.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 text-center">
                <TrendingUp className="mx-auto text-zinc-800 mb-2.5" size={32} />
                <p className="text-[13px] font-bold text-zinc-500">No Open Positions</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Live P&L updates will be shown here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {brokerPositions.map((pos, idx) => {
                  const quantity = pos.quantity || 0;
                  // Handle real-time current price mapped from WS tick data if available, fallback to broker last_price
                  const ltp = stocks[pos.symbol]?.ltp || pos.current_price || 0; 
                  const pnl = (ltp - pos.average_price) * quantity;
                  const isProfit = pnl >= 0;

                  return (
                    <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 flex justify-between items-center">
                      <div>
                         <p className="text-[13px] font-bold text-white tracking-tight">{pos.symbol}</p>
                         <p className="text-[10px] text-zinc-500 mt-1">Qty: {quantity} • Avg: {formatCurrency(pos.average_price)}</p>
                      </div>
                      <div className="text-right">
                         <p className={cn("text-[13px] font-bold", isProfit ? "text-emerald-500" : "text-rose-500")}>
                           {isProfit ? '+' : ''}{formatCurrency(pnl)}
                         </p>
                         <p className="text-[10px] text-zinc-500 mt-1">LTP: {formatCurrency(ltp)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Removed fullChain prop so the internal ATM logic handles rendering appropriately based on User Role */}
        {activeSegment === 'F&O' && (
          <div className="space-y-4">
            <OptionChain onPlaceOrder={onPlaceOrder} stocks={optionChainStocks} />
          </div>
        )}
      </div>

      {/* Stock Detail Modal */}
      <AnimatePresence mode="wait">
        {selectedStock && (() => {
          const quote = stocks[selectedStock];
          const ltp = typeof quote === 'number' ? quote : (quote?.ltp || 0);
          const change = quote?.change || 0;
          const changePct = quote?.changePercent || 0;
          const isPositive = change >= 0;

          return (
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
                  onClick={() => toggleWatchlist(selectedStock)}
                  className={cn(
                    "p-3 rounded-2xl transition-all",
                    watchlist.includes(selectedStock) ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"
                  )}
                >
                  <Plus size={24} className={cn(watchlist.includes(selectedStock) && "rotate-45")} />
                </button>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">
                <div className="text-center">
                  <p className="text-5xl font-bold tracking-tighter mb-2">{formatCurrency(ltp)}</p>
                  <p className={cn("text-sm font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                    {isPositive ? '+' : ''}{formatCurrency(Math.abs(change))} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%) Today
                  </p>
                </div>

                <div className="h-80 bg-zinc-900/50 rounded-4xl border border-zinc-800/50 relative overflow-hidden">
                  <ErrorBoundary>
                    {/* Replaced TradingViewWidget with TradingTerminal */}
                    <TradingTerminal 
                      instrumentKey={selectedStock} 
                      // Optionally update the local selected stock price if you have state for it
                    />
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
                      <p className="text-sm font-bold text-white">{(ltp * 0.92).toFixed(2)}</p>
                    </div>
                    <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">52W High</p>
                      <p className="text-sm font-bold text-white">{(ltp * 1.15).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
                <button 
                  onClick={() => onPlaceOrder({ side: 'SELL', symbol: selectedStock, price: ltp })}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10"
                >
                  SELL
                </button>
                <button 
                  onClick={() => onPlaceOrder({ side: 'BUY', symbol: selectedStock, price: ltp })}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10"
                >
                  BUY
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default Market;