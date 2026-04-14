import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Newspaper, Calendar, Activity, Bell, Zap, ChevronRight, ZapOff, BarChart3, Link2, RefreshCw } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import Sparkline from '../components/Sparkline';
import TradingViewWidget from '../components/TradingViewWidget';
import { useAuthStore } from '../store/authStore';
import AISignals from './admin/AISignals';
import { apiClient } from '../api/client';

const Dashboard = ({ stocks, onMarketClick, onIndexClick, onProfileClick }: { stocks: Record<string, number>, onMarketClick: () => void, onIndexClick: (index: string) => void, onProfileClick: () => void }) => {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [gainerLoserTab, setGainerLoserTab] = useState<'Gainers' | 'Losers'>('Gainers');
  const [eventFilter, setEventFilter] = useState('Upcoming');
  const [confirmExit, setConfirmExit] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await apiClient.get('/api/portfolio');
        const portfolioArray = Array.isArray(res.data) ? res.data : [];
        // ✅ FIX: Only set holdings — positions stay empty to avoid field-name mismatch
        // (holdings don't have pos.ltp / pos.avgPrice / pos.pnl fields)
        setHoldings(portfolioArray);
      } catch (e) {
        console.error("Failed to fetch portfolio", e);
      }
    };
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpstoxConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await apiClient.get('/api/auth/uptox/url');
      const { url } = res.data;
      const width = 500, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(url, 'UpstoxAuth', `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no`);
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); setIsConnecting(false); }
      }, 500);
    } catch (err: any) {
      toast.error('Failed to initialize Upstox connection.');
      setIsConnecting(false);
    }
  };

  const handleExit = async (index: number) => {
    const pos = positions[index];
    if (confirmExit === index) {
      toast.info(`Placing exit order for ${pos.symbol}...`);
      setPositions(positions.filter((_, i) => i !== index));
      setConfirmExit(null);
    } else {
      setConfirmExit(index);
      setTimeout(() => setConfirmExit(null), 3000);
    }
  };

  // ✅ FIX: Use correct field names from the Holding interface
  // OLD (broken): stocks[curr.trading_symbol] || curr.last_price  → always undefined
  // NEW (correct): stocks[curr.symbol] || curr.current_price      → correct fields
  const totalInvested = holdings.reduce(
    (acc, curr) => acc + curr.quantity * curr.average_price, 0
  );

  const currentValue = holdings.reduce((acc, curr) => {
    const ltp =
      stocks[curr.symbol] ||     // live WebSocket price (best)
      curr.current_price ||      // Upstox API snapshot (fallback)
      curr.average_price;        // safe fallback — P&L = ₹0 for this holding
    return acc + curr.quantity * ltp;
  }, 0);

  const dayPnL = positions.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
  const totalPnL = currentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const isDataLive = stocks['NIFTY 50'] > 0;

  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];

  const news = [
    { id: 1, headline: "Reliance Industries expansion plans drive stock higher", source: "Mint", time: "2h ago", thumb: "https://picsum.photos/seed/reliance/100/100" },
    { id: 2, headline: "RBI maintains repo rate, market reacts positively", source: "ET Now", time: "4h ago", thumb: "https://picsum.photos/seed/rbi/100/100" },
    { id: 3, headline: "NIFTY hits record high amid global rally", source: "CNBC TV18", time: "5h ago", thumb: "https://picsum.photos/seed/nifty/100/100" },
  ];

  const marketEvents = [
    { id: 1, company: "RELIANCE", type: "Results", date: "15 Mar 2026", countdown: "In 15 Days", color: "blue" },
    { id: 2, company: "TCS", type: "Dividend", date: "05 Mar 2026", countdown: "In 5 Days", color: "green" },
    { id: 3, company: "HDFCBANK", type: "Board Meeting", date: "03 Mar 2026", countdown: "In 3 Days", color: "orange" },
    { id: 4, company: "INFY", type: "Bonus", date: "20 Mar 2026", countdown: "In 20 Days", color: "purple" },
  ];

  const stocksInNews = [
    { symbol: "TATASTEEL", change: 2.45, tag: "Order Win" },
    { symbol: "ADANIENT", change: -1.20, tag: "Earnings Beat" },
    { symbol: "ZOMATO", change: 5.12, tag: "Expansion" },
    { symbol: "PAYTM", change: -3.40, tag: "Regulatory" },
    { symbol: "JIOFIN", change: 1.80, tag: "New Product" },
  ];

  const volumeRockers = [
    { symbol: "YESBANK", price: 28.45, change: 12.4, volumeMultiplier: "8.5x" },
    { symbol: "SUZLON", price: 45.10, change: -4.2, volumeMultiplier: "5.2x" },
    { symbol: "IDEA", price: 14.20, change: 8.1, volumeMultiplier: "4.1x" },
    { symbol: "RVNL", price: 245.60, change: 6.5, volumeMultiplier: "3.8x" },
  ];

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'All') return marketEvents;
    if (eventFilter === 'This Week') return marketEvents.slice(0, 2);
    return marketEvents.filter(e => e.countdown.includes('Days'));
  }, [eventFilter, marketEvents]);

  const sortedGainersLosers = useMemo(() => {
    const list = Object.entries(stocks)
      .filter(([s]) => !primaryIndices.includes(s) && !secondaryIndices.includes(s))
      .map(([symbol, price]) => ({ symbol, price, change: 0 }));
    return list.slice(0, 5);
  }, [stocks, primaryIndices, secondaryIndices]);

  return (
    <div className="space-y-5 pb-20">

      {/* ── Market Indices ── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Indices</h3>
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-3 py-2">
          {[...primaryIndices, ...secondaryIndices].map(index => (
            <motion.div
              key={index}
              whileHover={{ y: -2 }}
              onClick={() => onIndexClick(index)}
              className="min-w-37.5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl pt-3 pb-4 px-4 flex flex-col gap-2 cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{index}</span>
                <Sparkline color={stocks[index] > (index.includes('SENSEX') ? 70000 : 20000) ? '#10b981' : '#ef4444'} />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-white">{stocks[index]?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                    stocks[index] > (index.includes('SENSEX') ? 70000 : 20000) ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                    {stocks[index] > (index.includes('SENSEX') ? 70000 : 20000) ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    <span>+1.24%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Portfolio Snapshot / Connect Upstox ── */}
      <div className="px-5">
        {!user?.is_uptox_connected ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-linear-to-r from-[#5228D3]/20 to-[#111827] border border-[#5228D3]/50 rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Link2 className="w-32 h-32 text-[#5228D3]" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-left w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-[#5228D3] text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">Action Required</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Step 2: Connect Your Broker</h2>
                <p className="text-zinc-400 text-[11px] max-w-xl leading-relaxed">
                  To view your portfolio, available funds, and execute trades on Aapa Capital, you must link your newly created Upstox account.
                </p>
              </div>
              <button
                onClick={handleUpstoxConnect}
                disabled={isConnecting}
                className="w-full md:w-auto whitespace-nowrap bg-[#5228D3] hover:bg-[#431db3] text-white font-black py-3 px-6 rounded-xl transition-all shadow-lg shadow-[#5228D3]/20 tracking-widest uppercase text-[10px] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {isConnecting ? 'Connecting...' : 'Connect Upstox'}
              </button>
            </div>
          </motion.div>
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
                {!isDataLive && <p className="text-[8px] text-zinc-600 font-medium mt-1">Waiting for market data...</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 pt-4 border-t border-zinc-800/50">
              <div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Invested</p>
                <p className="text-[13px] font-bold text-zinc-300">{formatCurrency(totalInvested)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Available Funds</p>
                <p className="text-[13px] font-bold text-zinc-300">{formatCurrency(user?.balance || 0)}</p>
              </div>
            </div>

            {/* ✅ NEW: Holdings mini-preview */}
            {holdings.length > 0 && (
              <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  Holdings ({holdings.length} stocks)
                </p>
                {holdings.slice(0, 3).map(h => {
                  const ltp = stocks[h.symbol] || h.current_price || h.average_price;
                  const pnl = (ltp - h.average_price) * h.quantity;
                  return (
                    <div key={h.symbol} className="flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-bold text-white">{h.symbol}</p>
                        <p className="text-[9px] text-zinc-600 uppercase">{h.quantity} qty</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-white">{formatCurrency(h.quantity * ltp)}</p>
                        <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {holdings.length > 3 && (
                  <p className="text-[9px] text-zinc-600 uppercase tracking-widest text-center pt-1">
                    +{holdings.length - 3} more in Portfolio tab
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Live F&O Positions (only shown when positions exist) ── */}
      {user?.role === 'user' && positions.length > 0 && (
        <div className="px-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Activity size={12} />Live F&O Positions
            </h3>
            <span className="text-[8px] font-bold text-zinc-700">{positions.length} Active</span>
          </div>
          <div className="space-y-2.5">
            {positions.map((pos, i) => (
              <div key={pos.symbol} className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white tracking-tight">{pos.symbol}</p>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-500 uppercase">{pos.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">{pos.quantity} Qty</p>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Avg {formatCurrency(pos.avgPrice || pos.average_price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-black tracking-tighter", (pos.ltp - (pos.avgPrice || pos.average_price)) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatCurrency((pos.ltp - (pos.avgPrice || pos.average_price)) * pos.quantity)}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-500 mt-1">LTP: <span className="text-white">{formatCurrency(pos.ltp)}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => handleExit(i)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    confirmExit === i ? "bg-rose-500 text-black" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
                  )}
                >
                  {confirmExit === i ? 'Confirm Exit' : 'Exit Position'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Market Sentiment ── */}
      <div className="px-5">
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">India VIX</p>
            <p className="text-[13px] font-bold text-white">14.25 <span className="text-emerald-500 text-[9px]">-2.4%</span></p>
          </div>
          <div className="h-7 w-px bg-zinc-800" />
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Adv / Dec</p>
            <p className="text-[13px] font-bold text-white">1240 / 850</p>
          </div>
          <div className="h-7 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Bullish</p>
          </div>
        </div>
      </div>

      {/* ── Top Gainers & Losers ── */}
      <div className="px-5 space-y-2.5">
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
          {['Gainers', 'Losers'].map(tab => (
            <button
              key={tab}
              onClick={() => setGainerLoserTab(tab as any)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                gainerLoserTab === tab ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {sortedGainersLosers.map(({ symbol, price, change }: { symbol: string, price: number, change: number }) => (
            <div key={symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
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
                <p className={cn("text-[9px] font-bold", change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Trading Signals ── */}
      <div className="px-5"><AISignals /></div>

      {/* ── Stocks in News ── */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Stocks in News</h3>
          <button onClick={onMarketClick} className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">View All</button>
        </div>
        <div className="space-y-2">
          {stocksInNews.map((stock) => (
            <div key={stock.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center">
                  <Newspaper size={16} className="text-zinc-600" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{stock.symbol}</p>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">{stock.tag}</span>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-[13px] font-bold", stock.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {stock.change >= 0 ? '+' : ''}{stock.change}%
                </p>
                <p className="text-[9px] font-bold text-zinc-600 uppercase">Today</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Volume Rockers ── */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Volume Rockers</h3>
          <Activity size={14} className="text-zinc-700" />
        </div>
        <div className="space-y-2">
          {volumeRockers.map((stock) => (
            <div key={stock.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                  {stock.symbol.substring(0, 2)}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{stock.symbol}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase">
                    Vol: <span className={cn("font-black", stock.change >= 0 ? "text-emerald-500" : "text-rose-500")}>{stock.volumeMultiplier}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(stock.price)}</p>
                <p className={cn("text-[9px] font-bold", stock.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {stock.change >= 0 ? '+' : ''}{stock.change}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Market News ── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market News</h3>
          <Newspaper size={14} className="text-zinc-700" />
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-2.5 py-2">
          {news.map(item => (
            <div key={item.id} className="min-w-65 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 flex gap-2.5">
              <img src={item.thumb} alt="" className="w-14 h-14 rounded-xl object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-bold text-white leading-snug line-clamp-2">{item.headline}</p>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{item.source}</span>
                  <span className="text-[8px] font-bold text-zinc-600">{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Market Events ── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Events</h3>
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
            {['Upcoming', 'This Week', 'All'].map(filter => (
              <button
                key={filter}
                onClick={() => setEventFilter(filter)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all",
                  eventFilter === filter ? "bg-zinc-800 text-white" : "text-zinc-500"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-2.5 py-2">
          {filteredEvents.map((event: any) => (
            <div key={event.id} className="min-w-45 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-start">
                <p className="text-[13px] font-bold text-white tracking-tight">{event.company}</p>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                  event.color === 'blue' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                  event.color === 'green' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                  event.color === 'orange' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                  event.color === 'purple' && "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                )}>
                  {event.type}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Calendar size={12} />
                  <span className="text-[10px] font-bold">{event.date}</span>
                </div>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{event.countdown}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;