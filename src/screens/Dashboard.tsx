import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  TrendingUp, ArrowUpRight, ArrowDownRight, Newspaper,
  Calendar, Activity, Bell, Zap, ChevronRight, ZapOff,
  BarChart3, Link2, RefreshCw, AlertTriangle, Loader2
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import Sparkline from '../components/Sparkline';
import TradingViewWidget from '../components/TradingViewWidget';
import { useAuthStore } from '../store/authStore';
import AISignals from './admin/AISignals';
import { apiClient } from '../api/client';
import MarketStatusPill from '../components/MarketStatusPill';
import { MarketPhase } from '../types';

// ── Price extraction helper ───────────────────────────────────────────────────
const getPriceData = (quote: any) => {
  if (!quote) return { ltp: 0, change: 0, changePct: 0 };
  if (typeof quote === 'number') return { ltp: quote, change: 0, changePct: 0 };
  const ltp = quote.ltp || quote.price || 0;
  const close = quote.close || quote.prevClose || quote.close_price || quote.previous_close || 0;
  let change = quote.day_change || quote.change || 0;
  let changePct = quote.day_change_pct || quote.changePercent || 0;
  if (!change && ltp && close) change = ltp - close;
  if (!changePct && ltp && close) changePct = (change / close) * 100;
  return { ltp, change, changePct };
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface VixData { vix: number | null; vixChange: number | null; advance: number | null; decline: number | null; source: string; }
interface NewsItem { id: string; headline: string; source: string; time: string; url?: string; thumb?: string | null; }
interface StockInNews { symbol: string; price: number | null; change: number | null; tag: string; isLive: boolean; }
interface VolumeRocker { symbol: string; price: number; change: number; volumeMultiplier: string; }
interface MarketEvent { id: number; company: string; symbol: string; type: string; date: string; countdown: string; color: string; }
interface MarketMover { symbol: string; lastPrice: number; change: number; changePercent: number; }

// ── DemoDataBadge — shown only when real data failed / unavailable ────────────
const DemoDataBadge = ({ label = "Sample Data" }: { label?: string }) => (
  <span
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-black uppercase tracking-widest text-amber-500 cursor-help"
    title="This widget shows demo / placeholder data. Real data integration is coming soon."
  >
    <Zap size={7} className="shrink-0" />
    {label}
  </span>
);

const LiveBadge = () => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest text-emerald-500">
    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
    Live
  </span>
);

const WidgetSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-14 rounded-xl bg-zinc-900/30 border border-zinc-800/30 animate-pulse" />
    ))}
  </div>
);

// ── Main Dashboard Component ──────────────────────────────────────────────────
const Dashboard = ({
  stocks,
  onMarketClick,
  onIndexClick,
  onProfileClick,
  marketPhase = 'CLOSED'
}: {
  stocks: Record<string, any>;
  onMarketClick: () => void;
  onIndexClick: (index: string) => void;
  onProfileClick: () => void;
  marketPhase?: MarketPhase;
}) => {
  const { user, refreshUser } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [availableFunds, setAvailableFunds] = useState<number | null>(null);
  const [gainerLoserTab, setGainerLoserTab] = useState<'Gainers' | 'Losers'>('Gainers');
  const [eventFilter, setEventFilter] = useState('Upcoming');
  const [confirmExit, setConfirmExit] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // ── Real data states ────────────────────────────────────────────────────────
  const [vixData, setVixData] = useState<VixData | null>(null);
  const [vixLoading, setVixLoading] = useState(true);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsIsReal, setNewsIsReal] = useState(false);

  const [stocksInNews, setStocksInNews] = useState<StockInNews[]>([]);
  const [sinLoading, setSinLoading] = useState(true);
  const [sinIsReal, setSinIsReal] = useState(false);

  const [volumeRockers, setVolumeRockers] = useState<VolumeRocker[]>([]);
  const [vrLoading, setVrLoading] = useState(true);
  const [vrIsReal, setVrIsReal] = useState(false);

  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsIsReal, setEventsIsReal] = useState(false);

  const [movers, setMovers] = useState<{ gainers: MarketMover[]; losers: MarketMover[] }>({ gainers: [], losers: [] });
  const [moversLoading, setMoversLoading] = useState(true);
  const [moversIsReal, setMoversIsReal] = useState(false);

  // ── Fetch portfolio ─────────────────────────────────────────────────────────
  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/portfolio');
      const payload = res.data?.data || res.data;
      if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.holdings)) setHoldings(payload.holdings);
        if (Array.isArray(payload.positions)) setPositions(payload.positions);
        if (payload.funds !== undefined) setAvailableFunds(payload.funds);
      }
    } catch (e) {
      console.error('Failed to fetch portfolio', e);
    }
  }, []);

  // ── Fetch real market data ──────────────────────────────────────────────────
  const fetchMarketData = useCallback(async () => {
    // India VIX + Adv/Dec
    setVixLoading(true);
    apiClient.get('/api/market/vix')
      .then(r => { setVixData(r.data); })
      .catch(() => setVixData(null))
      .finally(() => setVixLoading(false));

    // Movers (Gainers / Losers)
    setMoversLoading(true);
    apiClient.get('/api/market/movers')
      .then(r => {
        const d = r.data;
        if (d.gainers?.length > 0 || d.losers?.length > 0) {
          setMovers({ gainers: d.gainers || [], losers: d.losers || [] });
          setMoversIsReal(d.source === 'upstox');
        }
      })
      .catch(() => {})
      .finally(() => setMoversLoading(false));

    // News
    setNewsLoading(true);
    apiClient.get('/api/market/news')
      .then(r => {
        const d = r.data;
        if (d.data?.length > 0) {
          setNews(d.data);
          setNewsIsReal(d.source !== 'unavailable' && d.source !== 'error');
        }
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));

    // Stocks in News
    setSinLoading(true);
    apiClient.get('/api/market/stocks-in-news')
      .then(r => {
        const d = r.data;
        if (d.data?.length > 0) {
          setStocksInNews(d.data);
          setSinIsReal(d.source !== 'unavailable' && d.source !== 'error');
        }
      })
      .catch(() => {})
      .finally(() => setSinLoading(false));

    // Volume Rockers
    setVrLoading(true);
    apiClient.get('/api/market/volume-rockers')
      .then(r => {
        const d = r.data;
        if (d.data?.length > 0) {
          setVolumeRockers(d.data);
          setVrIsReal(d.source === 'upstox');
        }
      })
      .catch(() => {})
      .finally(() => setVrLoading(false));

    // Market Events
    setEventsLoading(true);
    apiClient.get('/api/market/events')
      .then(r => {
        const d = r.data;
        if (d.data?.length > 0) {
          setMarketEvents(d.data);
          setEventsIsReal(d.source === 'supabase');
        }
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    fetchPortfolio();
    fetchMarketData();

    // Auto-refresh VIX & Movers every 60s during live market
    const interval = setInterval(() => {
      if (marketPhase === 'LIVE') {
        apiClient.get('/api/market/vix').then(r => setVixData(r.data)).catch(() => {});
        apiClient.get('/api/market/movers').then(r => {
          if (r.data.gainers?.length > 0 || r.data.losers?.length > 0) {
            setMovers({ gainers: r.data.gainers || [], losers: r.data.losers || [] });
          }
        }).catch(() => {});
      }
    }, 60_000);

    window.addEventListener('broker_portfolio_updated', fetchPortfolio);
    return () => {
      clearInterval(interval);
      window.removeEventListener('broker_portfolio_updated', fetchPortfolio);
    };
  }, [fetchPortfolio, fetchMarketData, marketPhase]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'UPTOX_AUTH_SUCCESS') {
        toast.success('Upstox connected successfully!');
        await refreshUser();
        await fetchPortfolio();
        await fetchMarketData(); // re-fetch now that token is available
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshUser, fetchPortfolio, fetchMarketData]);

  const handleUpstoxConnect = async () => {
    setIsConnecting(true);
    const width = 500, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const authWindow = window.open('about:blank', 'UpstoxAuth',
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no`);
    try {
      const res = await apiClient.get('/api/auth/uptox/url');
      const { url, error } = res.data;
      if (url && authWindow) { authWindow.location.href = url; }
      else { authWindow?.close(); toast.error(error || 'Upstox configuration missing on server'); }
    } catch {
      authWindow?.close();
      toast.error('Failed to initialize Upstox connection.');
    } finally { setIsConnecting(false); }
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

  const displayFunds = availableFunds !== null ? availableFunds : (user?.balance || 0);
  const isDataLive = marketPhase === 'LIVE';

  let totalInvested = 0, currentValue = 0;
  holdings.forEach(h => {
    const { ltp } = getPriceData(stocks[h.symbol]);
    const fp = ltp || h.current_price || h.average_price;
    totalInvested += h.quantity * h.average_price;
    currentValue  += h.quantity * fp;
  });
  positions.forEach(p => {
    const { ltp } = getPriceData(stocks[p.symbol]);
    const fp = ltp || p.current_price || p.average_price;
    totalInvested += p.quantity * (p.avgPrice || p.average_price);
    currentValue  += p.quantity * fp;
  });
  const totalPnL = currentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const primaryIndices   = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'All') return marketEvents;
    if (eventFilter === 'This Week') return marketEvents.filter(e => e.countdown.includes('Tomorrow') || e.countdown === 'Today!' || (e.countdown.includes('Days') && parseInt(e.countdown.split(' ')[1]) <= 7));
    return marketEvents;
  }, [eventFilter, marketEvents]);

  // ── Fallback demo data (shown only when API fails) ──────────────────────────
  const fallbackMovers = {
    gainers: [
      { symbol: "ZOMATO", lastPrice: 201.40, change: 12.30, changePercent: 6.5 },
      { symbol: "TATASTEEL", lastPrice: 154.20, change: 6.10, changePercent: 4.12 }
    ],
    losers: [
      { symbol: "PAYTM", lastPrice: 168.10, change: -4.50, changePercent: -2.60 },
      { symbol: "HDFCBANK", lastPrice: 1420.50, change: -25.40, changePercent: -1.75 }
    ]
  };
  const fallbackStocksInNews: StockInNews[] = [
    { symbol: "TATASTEEL", price: null, change: 2.45, tag: "Order Win", isLive: false },
    { symbol: "ADANIENT",  price: null, change: -1.20, tag: "Earnings Beat", isLive: false },
    { symbol: "ZOMATO",    price: null, change: 5.12, tag: "Expansion", isLive: false },
  ];
  const fallbackVolumeRockers: VolumeRocker[] = [
    { symbol: "YESBANK", price: 28.45, change: 12.4, volumeMultiplier: "8.5x" },
    { symbol: "SUZLON",  price: 45.10, change: -4.2, volumeMultiplier: "5.2x" },
  ];
  const fallbackEvents: MarketEvent[] = [
    { id: 1, company: "RELIANCE", symbol: "RELIANCE", type: "Results",       date: "15 May 2026", countdown: "In 15 Days", color: "blue" },
    { id: 2, company: "TCS",      symbol: "TCS",      type: "Dividend",      date: "05 May 2026", countdown: "In 5 Days",  color: "green" },
    { id: 3, company: "HDFCBANK", symbol: "HDFCBANK", type: "Board Meeting", date: "03 May 2026", countdown: "In 3 Days",  color: "orange" },
  ];

  const currentMovers           = movers[gainerLoserTab.toLowerCase() as 'gainers' | 'losers'];
  const displayMovers           = currentMovers.length > 0  ? currentMovers  : fallbackMovers[gainerLoserTab.toLowerCase() as 'gainers' | 'losers'];
  const displayStocksInNews     = stocksInNews.length > 0   ? stocksInNews   : fallbackStocksInNews;
  const displayVolumeRockers    = volumeRockers.length > 0  ? volumeRockers  : fallbackVolumeRockers;
  const displayEvents           = marketEvents.length > 0   ? marketEvents   : fallbackEvents;
  const displayFilteredEvents   = marketEvents.length > 0   ? filteredEvents : fallbackEvents;

  return (
    <div className="space-y-5 pb-20">

      {/* ── Market Indices ─────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Indices</h3>
          <MarketStatusPill phase={marketPhase} />
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-3 py-2">
          {[...primaryIndices, ...secondaryIndices].map(index => {
            const { ltp, change, changePct } = getPriceData(stocks[index]);
            const isPositive = change >= 0;
            return (
              <motion.div
                key={index}
                whileHover={{ y: -2 }}
                onClick={() => onIndexClick(index)}
                className="min-w-37.5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl pt-3 pb-4 px-4 flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{index}</span>
                  <Sparkline color={isPositive ? '#10b981' : '#ef4444'} />
                </div>
                <div>
                  <p className="text-lg font-black tracking-tight text-white">
                    {ltp ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                      isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      <span>{isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Portfolio / Connect Upstox ─────────────────────────────────────── */}
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
                  To view your portfolio, available funds, and execute trades on Aapa Capital, you must link your Upstox account.
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
                  <div className={cn("w-1.5 h-1.5 rounded-full", isDataLive ? "bg-emerald-500 animate-pulse" : "bg-zinc-500")} />
                  <p className={cn("text-[9px] font-bold uppercase tracking-widest", isDataLive ? "text-emerald-500" : "text-zinc-500")}>
                    {isDataLive ? "Live" : marketPhase === 'PRE_OPEN' ? "Pre-Open" : "Closed"}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-800/50">
              <div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Invested</p>
                <p className="text-[13px] font-bold text-zinc-300">{formatCurrency(totalInvested)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Current Value</p>
                <p className="text-[13px] font-bold text-zinc-300">{formatCurrency(currentValue)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Available Funds</p>
                <p className="text-[13px] font-bold text-zinc-300">{formatCurrency(displayFunds)}</p>
              </div>
            </div>
            {holdings.length > 0 && (
              <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Holdings ({holdings.length} stocks)</p>
                {holdings.slice(0, 3).map(h => {
                  const { ltp } = getPriceData(stocks[h.symbol]);
                  const fp = ltp || h.current_price || h.average_price;
                  const pnl = (fp - h.average_price) * h.quantity;
                  return (
                    <div key={h.symbol} className="flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-bold text-white">{h.symbol}</p>
                        <p className="text-[9px] text-zinc-600 uppercase">{h.quantity} qty</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-white">{formatCurrency(h.quantity * fp)}</p>
                        <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {holdings.length > 3 && (
                  <p className="text-[9px] text-zinc-600 uppercase tracking-widest text-center pt-1">+{holdings.length - 3} more in Portfolio tab</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Live Positions ─────────────────────────────────────────────────── */}
      {user?.role === 'user' && positions.length > 0 && (
        <div className="px-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Activity size={12} />Live F&O Positions
            </h3>
            <span className="text-[8px] font-bold text-zinc-700">{positions.length} Active</span>
          </div>
          <div className="space-y-2.5">
            {positions.map((pos, i) => {
              const { ltp } = getPriceData(stocks[pos.symbol]);
              const fp = ltp || pos.current_price || pos.average_price;
              const pnl = (fp - (pos.avgPrice || pos.average_price)) * pos.quantity;
              return (
                <div key={pos.symbol} className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white tracking-tight">{pos.symbol}</p>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-500 uppercase">{pos.type || pos.product}</span>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">{pos.quantity} Qty · Avg {formatCurrency(pos.avgPrice || pos.average_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-black tracking-tighter", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatCurrency(pnl)}</p>
                      <p className="text-[10px] font-bold text-zinc-500 mt-1">LTP: <span className="text-white">{formatCurrency(fp)}</span></p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExit(i)}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      confirmExit === i ? "bg-rose-500 text-black" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
                    )}
                  >{confirmExit === i ? 'Confirm Exit' : 'Exit Position'}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── India VIX + Adv/Dec (REAL DATA from Upstox) ───────────────────── */}
      <div className="px-5">
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center">
          {vixLoading ? (
            <div className="w-full flex justify-center py-2"><Loader2 size={16} className="text-zinc-600 animate-spin" /></div>
          ) : (
            <>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">India VIX</p>
                  {vixData?.source === 'upstox' ? <LiveBadge /> : <DemoDataBadge />}
                </div>
                {vixData?.vix != null ? (
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold text-white">{vixData.vix.toFixed(2)}</p>
                    {vixData.vixChange != null && (
                      <span className={cn("text-[10px] font-bold", vixData.vixChange >= 0 ? "text-rose-400" : "text-emerald-400")}>
                        {vixData.vixChange >= 0 ? '▲' : '▼'} {Math.abs(vixData.vixChange)}%
                      </span>
                    )}
                  </div>
                ) : <p className="text-[13px] font-bold text-zinc-600">—</p>}
              </div>
              <div className="h-7 w-px bg-zinc-800" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Adv / Dec</p>
                  {vixData?.source === 'upstox' ? <LiveBadge /> : <DemoDataBadge />}
                </div>
                {vixData?.advance != null ? (
                  <p className="text-[13px] font-bold">
                    <span className="text-emerald-500">{vixData.advance}</span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="text-rose-500">{vixData.decline}</span>
                  </p>
                ) : <p className="text-[13px] font-bold text-zinc-600">— / —</p>}
              </div>
              <div className="h-7 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                {vixData?.source === 'upstox'
                  ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><p className="text-[9px] font-bold text-emerald-500 uppercase">Live</p></>
                  : <><div className="w-1.5 h-1.5 rounded-full bg-zinc-600" /><p className="text-[9px] font-bold text-zinc-500 uppercase">Coming Soon</p></>
                }
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top Gainers / Losers (REAL — from /api/market/movers) ─────── */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Top Movers (Nifty 50)</h3>
            {moversIsReal ? <LiveBadge /> : <DemoDataBadge />}
          </div>
          <Activity size={14} className="text-zinc-700" />
        </div>
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
          {['Gainers', 'Losers'].map(tab => (
            <button
              key={tab}
              onClick={() => setGainerLoserTab(tab as any)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                gainerLoserTab === tab ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500"
              )}
            >{tab}</button>
          ))}
        </div>
        {moversLoading ? (
           <WidgetSkeleton rows={3} />
        ) : (displayMovers.length < 1 ? (
          <motion.div
            key={`empty-${gainerLoserTab}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-10 gap-2.5"
          >
            <BarChart3 size={28} className="text-zinc-700" />
            <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">No Data</p>
            <p className="text-[9px] text-zinc-700 text-center">Data will appear once fetched.</p>
          </motion.div>
        ) : (
          <div className={cn("space-y-2", !moversIsReal && "opacity-50 pointer-events-none select-none")}>
            {displayMovers.map(({ symbol, lastPrice, change, changePercent }) => (
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
                  <p className="text-[13px] font-bold text-white">{formatCurrency(lastPrice)}</p>
                  <p className={cn("text-[9px] font-bold", change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="px-5"><AISignals /></div>

      {/* ── Stocks in News (REAL — NewsData.io + Upstox price) ────────────── */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Stocks in News</h3>
            {sinIsReal ? <LiveBadge /> : <DemoDataBadge />}
          </div>
          <button onClick={onMarketClick} className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">View All</button>
        </div>
        {sinLoading ? (
          <WidgetSkeleton rows={3} />
        ) : (
          <div className={cn("space-y-2", !sinIsReal && "opacity-50 pointer-events-none select-none")}>
            {displayStocksInNews.map((stock) => (
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
                  {stock.price && <p className="text-[11px] font-bold text-zinc-400">{formatCurrency(stock.price)}</p>}
                  {stock.change != null ? (
                    <p className={cn("text-[13px] font-bold", stock.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </p>
                  ) : <p className="text-[11px] text-zinc-600">—</p>}
                  {!stock.isLive && <p className="text-[8px] font-bold text-zinc-700 uppercase">Demo</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Volume Rockers (REAL — Upstox volume filter) ──────────────────── */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Volume Rockers</h3>
            {vrIsReal ? <LiveBadge /> : <DemoDataBadge />}
          </div>
          <Activity size={14} className="text-zinc-700" />
        </div>
        {vrLoading ? (
          <WidgetSkeleton rows={3} />
        ) : (
          <div className={cn("space-y-2", !vrIsReal && "opacity-50 pointer-events-none select-none")}>
            {displayVolumeRockers.map((stock) => (
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
        )}
      </div>

      {/* ── Market News (REAL — NewsData.io) ──────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market News</h3>
            {newsIsReal ? <LiveBadge /> : <DemoDataBadge />}
          </div>
          <Newspaper size={14} className="text-zinc-700" />
        </div>
        {newsLoading ? (
          <div className="px-5"><WidgetSkeleton rows={2} /></div>
        ) : news.length > 0 ? (
          <div className={cn("px-5 overflow-x-auto scrollbar-hide flex gap-2.5 py-2", !newsIsReal && "opacity-50 pointer-events-none select-none")}>
            {news.map(item => (
              <a
                key={item.id}
                href={item.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-65 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 flex gap-2.5 cursor-pointer hover:border-zinc-700/50 transition-colors"
              >
                {item.thumb ? (
                  <img src={item.thumb} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                    <Newspaper size={20} className="text-zinc-600" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-[11px] font-bold text-white leading-snug line-clamp-2">{item.headline}</p>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase">{item.source}</span>
                    <span className="text-[8px] font-bold text-zinc-600">{item.time}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="px-5 py-6 text-center text-[10px] text-zinc-600">No news available right now</div>
        )}
      </div>

      {/* ── Market Events (REAL — Supabase) ───────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market Events</h3>
            {eventsIsReal ? <LiveBadge /> : <DemoDataBadge />}
          </div>
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
            {['Upcoming', 'This Week', 'All'].map(filter => (
              <button
                key={filter}
                onClick={() => setEventFilter(filter)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all",
                  eventFilter === filter ? "bg-zinc-800 text-white" : "text-zinc-500"
                )}
              >{filter}</button>
            ))}
          </div>
        </div>
        {eventsLoading ? (
          <div className="px-5"><WidgetSkeleton rows={2} /></div>
        ) : (
          <div className={cn("px-5 overflow-x-auto scrollbar-hide flex gap-2.5 py-2", !eventsIsReal && "opacity-50 pointer-events-none select-none")}>
            {displayFilteredEvents.map((event) => (
              <div key={event.id} className="min-w-45 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="text-[13px] font-bold text-white tracking-tight">{event.company}</p>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                    event.color === 'blue'   && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                    event.color === 'green'  && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                    event.color === 'orange' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                    event.color === 'purple' && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                    event.color === 'red'    && "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  )}>{event.type}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Calendar size={12} />
                    <span className="text-[10px] font-bold">{event.date}</span>
                  </div>
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    event.countdown === 'Today!' ? "text-rose-400" : "text-emerald-500"
                  )}>{event.countdown}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;