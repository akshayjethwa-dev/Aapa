import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  User as UserIcon, 
  PieChart, 
  ShieldCheck, 
  Bell, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  Zap,
  ChevronRight,
  ArrowLeft,
  Filter,
  Settings2,
  LogOut,
  Settings,
  HelpCircle,
  FileText,
  MoreHorizontal,
  Info,
  History,
  CreditCard,
  Users,
  AlertTriangle,
  Newspaper,
  Activity,
  Target,
  XCircle,
  AlertCircle,
  Calendar,
  ArrowRightLeft,
  BarChart3,
  MousePointer2,
  ZapOff,
  Layers,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useAuthStore } from './store/authStore';
import { cn, formatCurrency } from './lib/utils';
import OptionChain from './components/OptionChain';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

// --- Types ---
interface Stock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

// --- Constants & Data ---

const INDEX_CONSTITUENTS: Record<string, string[]> = {
  "NIFTY 50": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK"],
  "BANKNIFTY": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "AUBANK", "BANDHANBNK", "FEDERALBNK", "IDFCFIRSTB"],
  "FINNIFTY": ["HDFCBANK", "ICICIBANK", "HDFCLIFE", "SBILIFE", "BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "RECLTD", "PFC", "MUTHOOTFIN"],
  "MIDCAP NIFTY": ["AUROPHARMA", "CUMMINSIND", "FEDERALBNK", "IDFCFIRSTB", "MPHASIS", "PERSISTENT", "POLYCAB", "TATACOMM", "VOLTAS", "YESBANK"],
  "SENSEX": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK"],
  "NIFTY IT": ["TCS", "INFY", "HCLTECH", "WIPRO", "LTIM", "TECHM", "PERSISTENT", "COFORGE", "MPHASIS", "KPITTECH"],
};

const F_O_INDICES = ["NIFTY 50", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY"];

// --- Components ---

const Sparkline = ({ color = '#10b981' }: { color?: string }) => (
  <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 23L10 15L20 18L30 8L40 12L50 2L59 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6">
            <AlertTriangle className="text-rose-500" size={32} />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-2">Something went wrong</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto mb-8">
            The application encountered an unexpected error. We've been notified and are looking into it.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-black font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all uppercase text-[10px] tracking-widest"
          >
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-zinc-900 rounded-xl text-left text-[10px] text-rose-400 overflow-auto max-w-full font-mono">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const TradingViewWidget = React.memo(({ symbol, height = "100%" }: { symbol: string, height?: string | number }) => {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!container.current) return;
    
    setLoading(true);
    const currentContainer = container.current;
    currentContainer.innerHTML = '';
    
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    currentContainer.appendChild(widgetContainer);
    
    const getTradingViewSymbol = (s: string) => {
      if (s.includes(':')) return s;
      
      if (s.includes(' CE') || s.includes(' PE')) {
        const parts = s.split(' ');
        const base = parts[0] === 'NIFTY' ? 'NIFTY' : parts[0] === 'BANKNIFTY' ? 'BANKNIFTY' : parts[0];
        return `NSE:${base}`; 
      }

      const mapping: Record<string, string> = {
        'NIFTY 50': 'NSE:NIFTY',
        'BANKNIFTY': 'NSE:BANKNIFTY',
        'FINNIFTY': 'NSE:CNXFINANCE',
        'MIDCAP NIFTY': 'NSE:NIFTY_MID_SELECT',
        'SENSEX': 'BSE:SENSEX',
        'NIFTY IT': 'NSE:CNXIT',
        'NIFTY AUTO': 'NSE:CNXAUTO',
        'NIFTY PHARMA': 'NSE:CNXPHARMA',
        'NIFTY METAL': 'NSE:CNXMETAL',
        'NIFTY FMCG': 'NSE:CNXFMCG',
        'NIFTY REALTY': 'NSE:CNXREALTY'
      };
      return mapping[s] || `NSE:${s}`;
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.crossOrigin = "anonymous";
    
    const config = {
      "autosize": true,
      "symbol": getTradingViewSymbol(symbol),
      "interval": "5",
      "timezone": "Asia/Kolkata",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "container_id": "tradingview_chart",
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com",
      "hide_side_toolbar": false,
      "withdateranges": true,
      "details": true,
      "hotlist": true,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650"
    };
    
    script.innerHTML = JSON.stringify(config);
    
    // Use a small delay to ensure the container is ready and not conflicting with animations
    const timeoutId = setTimeout(() => {
      if (currentContainer) {
        currentContainer.appendChild(script);
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container relative" ref={container} style={{ height, width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Real-Time Chart...</p>
        </div>
      )}
    </div>
  );
});

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { user } = useAuthStore();
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'market', icon: TrendingUp, label: 'Market' },
    { id: 'fo', icon: Zap, label: 'F&O' },
    { id: 'portfolio', icon: PieChart, label: 'Portfolio' },
    ...(user?.role === 'admin' ? [{ id: 'admin', icon: ShieldCheck, label: 'Admin' }] : []),
    { id: 'more', icon: Wallet, label: 'Account' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-900 px-6 py-2.5 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300",
            activeTab === tab.id ? "text-emerald-500 scale-110" : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

const Header = ({ onProfileClick, onSearchClick }: { onProfileClick: () => void, onSearchClick: () => void }) => {
  const { user } = useAuthStore();
  return (
    <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-2.5 flex justify-between items-center z-50">
      <div className="flex items-center gap-4 cursor-pointer group" onClick={onProfileClick}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
          <img src="/aapa-icon.png" alt="AAPA" className="w-full h-full object-cover scale-110" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-lg font-black tracking-tighter text-white flex items-center">
          AAPA <span className="text-emerald-500 ml-1.5">CAPITAL</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onSearchClick}
          className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 transition-colors"
        >
          <Search size={20} />
        </button>
        <button className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-black" />
        </button>
      </div>
    </header>
  );
};

const Dashboard = ({ stocks, onMarketClick, onIndexClick, onProfileClick }: { stocks: Record<string, number>, onMarketClick: () => void, onIndexClick: (index: string) => void, onProfileClick: () => void }) => {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [gainerLoserTab, setGainerLoserTab] = useState<'Gainers' | 'Losers'>('Gainers');
  const [eventFilter, setEventFilter] = useState('Upcoming');
  const [confirmExit, setConfirmExit] = useState<number | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      try {
        const hRes = await fetch('/api/portfolio/holdings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (hRes.ok) {
          const hData = await hRes.json();
          if (hData.status === 'success') setHoldings(hData.data);
        }

        const pRes = await fetch('/api/portfolio/positions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const posArray = Array.isArray(pData) ? pData : (pData.status === 'success' ? pData.data : []);
          setPositions(posArray);
        }
      } catch (e) {
        console.error("Failed to fetch portfolio", e);
      }
    };
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const totalInvested = holdings.reduce((acc, curr) => acc + (curr.quantity * curr.average_price), 0);
  const currentValue = holdings.reduce((acc, curr) => {
    const ltp = stocks[curr.trading_symbol] || curr.last_price || curr.average_price;
    return acc + (curr.quantity * ltp);
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
      .map(([symbol, price]) => ({ symbol, price, change: 0 })); // We don't have change in ticker yet, so 0
    
    return list.slice(0, 5);
  }, [stocks, primaryIndices, secondaryIndices]);

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
              onClick={() => onIndexClick(index)}
              className="min-w-[150px] bg-zinc-900/40 border border-zinc-800/50 rounded-2xl pt-3 pb-4 px-4 flex flex-col gap-2 cursor-pointer"
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

      {/* Portfolio Snapshot */}
      <div className="px-5">
        {(!user?.is_uptox_connected && user?.role !== 'user') ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <Zap className="text-emerald-500" size={24} fill="currentColor" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">Connect Upstox for Real Data</h4>
              <p className="text-[10px] text-zinc-500 font-medium">Link your broker account to see live prices, option chains, and your real portfolio.</p>
            </div>
            <button 
              onClick={onProfileClick}
              className="w-full bg-emerald-500 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all"
            >
              Connect Now
            </button>
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
                {!isDataLive && (
                  <p className="text-[8px] text-zinc-600 font-medium mt-1">Waiting for market data...</p>
                )}
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
          </div>
        )}
      </div>

      {/* Live F&O Positions for Users */}
      {user?.role === 'user' && positions.length > 0 && (
        <div className="px-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Activity size={12} />
              Live F&O Positions
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
                    <p className="text-[10px] font-bold text-zinc-500 mt-1">
                      LTP: <span className="text-white">{formatCurrency(pos.ltp)}</span>
                    </p>
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

      {/* Market Sentiment Section */}
      <div className="px-5">
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">India VIX</p>
            <p className="text-[13px] font-bold text-white">14.25 <span className="text-emerald-500 text-[9px]">-2.4%</span></p>
          </div>
          <div className="h-7 w-[1px] bg-zinc-800" />
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Adv / Dec</p>
            <p className="text-[13px] font-bold text-white">1240 / 850</p>
          </div>
          <div className="h-7 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Bullish</p>
          </div>
        </div>
      </div>

      {/* Top Gainers & Losers */}
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
          {sortedGainersLosers.map(({ symbol, price, change }) => (
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

      {/* AI Trading Signals */}
      <div className="px-5">
        <AISignals />
      </div>

      {/* Stocks in News */}
      <div className="px-5 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Stocks in News</h3>
          <button 
            onClick={onMarketClick}
            className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest"
          >
            View All
          </button>
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
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                    {stock.tag}
                  </span>
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

      {/* Volume Rockers */}
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

      {/* Market News Section */}
      <div className="space-y-2.5">
        <div className="px-5 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Market News</h3>
          <Newspaper size={14} className="text-zinc-700" />
        </div>
        <div className="px-5 overflow-x-auto scrollbar-hide flex gap-2.5 py-2">
          {news.map(item => (
            <div key={item.id} className="min-w-[260px] bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 flex gap-2.5">
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

      {/* Market Events */}
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
          {filteredEvents.map(event => (
            <div key={event.id} className="min-w-[180px] bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-2">
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

const IndexOverview = ({ indexName, stocks, onClose, onOpenOptionChain }: { 
  indexName: string, 
  stocks: Record<string, number>, 
  onClose: () => void,
  onOpenOptionChain: () => void 
}) => {
  const [sortBy, setSortBy] = useState<'change' | 'volume'>('change');
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('list');
  const [activeChart, setActiveChart] = useState<any>(null);
  
  const price = stocks[indexName] || 0;
  const change = 1.24; // Mock
  const isPositive = change >= 0;

  const constituents = useMemo(() => {
    const symbols = INDEX_CONSTITUENTS[indexName] || [];
    return symbols.map(symbol => ({
      symbol,
      price: stocks[symbol] || (Math.random() * 2000 + 500),
      change: (Math.random() * 4 - 1.5),
      volume: Math.floor(Math.random() * 50000000) + 1000000
    }));
  }, [indexName, stocks]);

  const sortedConstituents = useMemo(() => {
    return [...constituents].sort((a, b) => {
      if (sortBy === 'change') return b.change - a.change;
      return b.volume - a.volume;
    });
  }, [constituents, sortBy]);

  // Mock chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: i,
      value: price * (1 + (Math.random() * 0.01 - 0.005))
    }));
  }, [price]);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[80] bg-white flex flex-col text-zinc-900"
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 text-zinc-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black tracking-tight">{indexName}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className={cn("text-[10px] font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
                {isPositive ? '+' : ''}{change}%
              </span>
            </div>
          </div>
        </div>
        <div className="w-24 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <Bar 
                dataKey="value" 
                fill={isPositive ? "#10b981" : "#ef4444"} 
                radius={[2, 2, 0, 0]}
                opacity={0.3}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-6 flex gap-3">
        <button 
          onClick={onOpenOptionChain}
          className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Zap size={14} className="text-emerald-500" />
          Option Chain
        </button>
        <button 
          onClick={() => setActiveChart({ symbol: indexName, ltp: price })}
          className="flex-1 bg-zinc-100 text-zinc-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <BarChart3 size={14} className="text-zinc-400" />
          Chart
        </button>
        <button 
          onClick={() => setViewMode(viewMode === 'list' ? 'heatmap' : 'list')}
          className={cn(
            "flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2",
            viewMode === 'heatmap' ? "bg-emerald-500 text-black shadow-xl shadow-emerald-500/20" : "bg-zinc-100 text-zinc-900"
          )}
        >
          <Layers size={14} className={viewMode === 'heatmap' ? "text-black" : "text-zinc-400"} />
          {viewMode === 'heatmap' ? 'List View' : 'Heatmap'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeChart && (
          <FullChartModal 
            key="full-chart-modal"
            instrument={activeChart} 
            onClose={() => setActiveChart(null)} 
          />
        )}
      </AnimatePresence>

      {/* Constituents Section */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {viewMode === 'list' ? (
          <>
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white py-2 z-10">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Constituents</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSortBy('change')}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all",
                    sortBy === 'change' ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                  )}
                >
                  % Change
                </button>
                <button 
                  onClick={() => setSortBy('volume')}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all",
                    sortBy === 'volume' ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                  )}
                >
                  Volume
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {sortedConstituents.map(stock => (
                <div key={stock.symbol} className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center font-black text-[10px] text-zinc-400">
                      {stock.symbol.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 tracking-tight">{stock.symbol}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">NSE • Vol: {(stock.volume / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block">
                      <Sparkline color={stock.change >= 0 ? '#10b981' : '#ef4444'} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-zinc-900">{formatCurrency(stock.price)}</p>
                      <p className={cn("text-[10px] font-black", stock.change >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {sortedConstituents.map(stock => (
              <div 
                key={stock.symbol}
                className={cn(
                  "aspect-square rounded-xl p-2 flex flex-col justify-between border",
                  stock.change >= 1 ? "bg-emerald-500 text-black border-emerald-600" :
                  stock.change > 0 ? "bg-emerald-100 text-emerald-900 border-emerald-200" :
                  stock.change > -1 ? "bg-rose-100 text-rose-900 border-rose-200" :
                  "bg-rose-500 text-white border-rose-600"
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-tighter">{stock.symbol}</p>
                <p className="text-[11px] font-bold">{stock.change.toFixed(2)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const OrderWindow = ({ config, onClose, onOrderPlaced }: { config: any, onClose: () => void, onOrderPlaced: () => void }) => {
  const { user, token } = useAuthStore();
  const [quantity, setQuantity] = useState(config.quantity || 1);
  const [orderType, setOrderType] = useState('Market');
  const [product, setProduct] = useState('Intraday');
  const [price, setPrice] = useState(config.price || 0);
  const [loading, setLoading] = useState(false);
  const [broker, setBroker] = useState(user?.is_uptox_connected ? 'uptox' : user?.is_angelone_connected ? 'angelone' : 'uptox');

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          broker,
          symbol: config.strike ? `${config.symbol} ${config.strike} ${config.optionType}` : config.symbol,
          type: config.side.toLowerCase(),
          order_type: orderType.toLowerCase(),
          quantity: parseInt(quantity),
          price: orderType === 'Market' ? config.price : parseFloat(price),
          product: product.toLowerCase()
        })
      });
      const data = await res.json();
      if (data.success) {
        onOrderPlaced();
        onClose();
        toast.success(`Order placed successfully via ${broker === 'uptox' ? 'Uptox' : 'Angel One'}!`);
      } else {
        toast.error(data.error || 'Order failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const connectedBrokers = [
    { id: 'uptox', name: 'Uptox', connected: user?.is_uptox_connected },
    { id: 'angelone', name: 'Angel One', connected: user?.is_angelone_connected }
  ].filter(b => b.connected);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-[110] bg-black flex flex-col"
    >
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">
              {config.side} {config.symbol.replace(' 50', '')}{config.strike ? ` ${config.strike} ${config.optionType}` : ''}
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {config.expiry || 'Equity • NSE'}
            </p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
          config.side === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {config.side}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        {/* Broker Selection */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Select Broker</p>
          <div className="flex gap-2">
            {connectedBrokers.length > 0 ? (
              connectedBrokers.map(b => (
                <button
                  key={b.id}
                  onClick={() => setBroker(b.id)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                    broker === b.id 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-900/30 border-zinc-800/50 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  {b.name}
                </button>
              ))
            ) : (
              <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">No Broker Connected</p>
                <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">Connect a broker in the 'More' tab to trade</p>
              </div>
            )}
          </div>
        </div>

        {config.strike && (
          <div className="grid grid-cols-3 gap-4 pb-6 border-b border-zinc-900">
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Strike</p>
              <p className="text-xs font-bold text-white">{config.strike}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Type</p>
              <p className="text-xs font-bold text-white">{config.optionType}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Expiry</p>
              <p className="text-xs font-bold text-white">{config.expiry}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Quantity</label>
            <input 
              type="number" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Price</label>
            <input 
              type="number" 
              disabled={orderType === 'Market'}
              value={orderType === 'Market' ? config.price : price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50" 
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Order Type</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Market', 'Limit'].map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  orderType === t ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Product</p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Intraday', 'Delivery'].map(p => (
              <button
                key={p}
                onClick={() => setProduct(p)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  product === p ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Approx Margin</p>
            <p className="text-sm font-bold text-white">{formatCurrency(quantity * (orderType === 'Market' ? config.price : price))}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Available</p>
            <p className="text-sm font-bold text-emerald-500">₹1,25,000.00</p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-black border-t border-zinc-900">
        <button 
          onClick={handlePlaceOrder}
          disabled={loading || connectedBrokers.length === 0}
          className={cn(
            "w-full font-black py-5 rounded-2xl transition-all shadow-xl uppercase text-xs tracking-widest",
            config.side === 'BUY' ? "bg-emerald-500 text-black shadow-emerald-500/10" : "bg-rose-500 text-black shadow-rose-500/10",
            (loading || connectedBrokers.length === 0) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? 'Processing...' : `${config.side} ${config.symbol}`}
        </button>
      </div>
    </motion.div>
  );
};

const IndexDetail = ({ indexName, stocks, onClose, onPlaceOrder }: { 
  indexName: string, 
  stocks: Record<string, number>, 
  onClose: () => void,
  onPlaceOrder: (config: any) => void
}) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'Stocks' | 'Option Chain'>(F_O_INDICES.includes(indexName) || indexName === 'SENSEX' ? 'Option Chain' : 'Stocks');
  const [expiry, setExpiry] = useState('2026-03-05'); // Default to next expiry
  const [selectedStrike, setSelectedStrike] = useState<any>(null);
  const [optionChainData, setOptionChainData] = useState<any[]>([]);
  const [loadingChain, setLoadingChain] = useState(false);
  const [activeChart, setActiveChart] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atmRef = useRef<HTMLDivElement>(null);
  
  const isFO = F_O_INDICES.includes(indexName) || indexName === 'SENSEX';
  const constituents = INDEX_CONSTITUENTS[indexName] || [];
  const spotPrice = stocks[indexName] || 0;
  
  const high = spotPrice * 1.005;
  const low = spotPrice * 0.992;

  const expiries = ['2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26'];
  const strikeInterval = indexName.includes('BANKNIFTY') ? 100 : 50;

  useEffect(() => {
    if (isFO && activeTab === 'Option Chain' && spotPrice > 0) {
      const fetchChain = async () => {
        setLoadingChain(true);
        try {
          const indexMap: Record<string, string> = {
            'NIFTY 50': 'NSE_INDEX|Nifty 50',
            'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
            'FINNIFTY': 'NSE_INDEX|Nifty Fin Service',
            'MIDCAP NIFTY': 'NSE_INDEX|Nifty Midcap 100',
            'SENSEX': 'BSE_INDEX|SENSEX'
          };
          const instrumentKey = indexMap[indexName] || `NSE_EQ|${indexName}`;
          const res = await fetch(`/api/option-chain?instrument_key=${instrumentKey}&expiry_date=${expiry}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) throw new Error('Failed to fetch option chain');
          const data = await res.json();
          if (data.status === 'success') {
            setOptionChainData(data.data);
          }
        } catch (e) {
          console.error("Failed to fetch option chain", e);
        } finally {
          setLoadingChain(false);
        }
      };
      fetchChain();
    }
  }, [indexName, expiry, activeTab, spotPrice]);

  const jumpToATM = () => {
    atmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Simulate LTP updates for flashing effect
  const [ltpUpdates, setLtpUpdates] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const interval = setInterval(() => {
      if (optionChainData.length > 0) {
        const randomIdx = Math.floor(Math.random() * optionChainData.length);
        const strike = optionChainData[randomIdx].strike_price;
        setLtpUpdates(prev => ({ ...prev, [strike]: true }));
        setTimeout(() => {
          setLtpUpdates(prev => ({ ...prev, [strike]: false }));
        }, 500);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [optionChainData]);

  const filteredChainData = useMemo(() => {
    return optionChainData;
  }, [optionChainData]);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[70] bg-zinc-50 flex flex-col text-zinc-900"
    >
      {/* Institutional Header */}
      <div className="px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between bg-white sticky top-0 z-[60]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[13px] font-bold tracking-tight text-zinc-900">{indexName}</h2>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Option Chain</p>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="relative group">
            <select 
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="bg-zinc-100 text-zinc-900 text-[10px] font-bold pl-2.5 pr-7 py-1 rounded-full border-none outline-none appearance-none cursor-pointer hover:bg-zinc-200 transition-colors"
            >
              {expiries.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => setActiveChart({ symbol: indexName, ltp: spotPrice })}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors"
          >
            <BarChart3 size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Filter size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Settings2 size={16} />
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
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide flex flex-col bg-white" ref={scrollRef}>
        {/* Day High/Low - Minimalist */}
        <div className="px-4 py-1.5 bg-zinc-50/50 border-b border-zinc-100 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Day High</span>
            <span className="text-[10px] font-bold text-emerald-600">{high.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Day Low</span>
            <span className="text-[10px] font-bold text-rose-600">{low.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {isFO && activeTab === 'Option Chain' ? (
          <div className="flex-1 flex flex-col relative">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_90px_1fr] border-b border-zinc-100 bg-white sticky top-0 z-30">
              <div className="py-2 text-center border-r border-zinc-100">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Call Price</span>
              </div>
              <div className="py-2 text-center bg-zinc-50/50">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Strike</span>
              </div>
              <div className="py-2 text-center border-l border-zinc-100">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Put Price</span>
              </div>
            </div>

            {/* Option Chain Rows */}
            <div className="divide-y divide-zinc-50 relative">
              {loadingChain ? (
                <div className="py-20 text-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loading Chain...</p>
                </div>
              ) : filteredChainData.length > 0 ? (
                filteredChainData.map((row, i) => {
                  const strike = row.strike_price;
                  const isATM = Math.abs(strike - spotPrice) < (strikeInterval / 2);
                  const isCallITM = strike < spotPrice;
                  const isPutITM = strike > spotPrice;

                  const callLtp = row.call_options?.market_data?.ltp || 0;
                  const putLtp = row.put_options?.market_data?.ltp || 0;
                  const callChange = row.call_options?.market_data?.perc_change || 0;
                  const putChange = row.put_options?.market_data?.perc_change || 0;

                  return (
                    <div 
                      key={strike} 
                      ref={isATM ? atmRef : null}
                      onClick={() => setSelectedStrike(null)}
                      className={cn(
                        "grid grid-cols-[1fr_90px_1fr] transition-colors relative group",
                        isATM ? "bg-emerald-50/30" : "hover:bg-zinc-50/50"
                      )}
                    >
                      {/* ATM Full Width Line */}
                      {isATM && (
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-emerald-500/50 z-20" />
                      )}

                      {/* CALL SIDE */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStrike({ strike, type: 'CE', price: callLtp });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 border-r border-zinc-100 cursor-pointer transition-all",
                          isCallITM && "bg-emerald-50/10",
                          selectedStrike?.strike === strike && selectedStrike?.type === 'CE' && "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
                        )}
                      >
                        <motion.span 
                          animate={ltpUpdates[strike] ? { scale: [1, 1.05, 1], color: ['#18181b', '#059669', '#18181b'] } : {}}
                          className="text-[13px] font-bold text-zinc-900"
                        >
                          {callLtp.toFixed(2)}
                        </motion.span>
                        <span className={cn("text-[9px] font-medium", callChange >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {callChange >= 0 ? '+' : ''}{callChange.toFixed(2)}%
                        </span>
                      </div>

                      {/* STRIKE PRICE */}
                      <div className={cn(
                        "flex flex-col items-center justify-center py-2.5 bg-zinc-50/30 relative",
                        isATM && "bg-emerald-100/20"
                      )}>
                        <span className={cn(
                          "tracking-tight transition-all",
                          isATM ? "text-base font-black text-emerald-700 scale-105" : "text-[13px] font-bold text-zinc-400"
                        )}>
                          {strike}
                        </span>
                      </div>

                      {/* PUT SIDE */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStrike({ strike, type: 'PE', price: putLtp });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 border-l border-zinc-100 cursor-pointer transition-all",
                          isPutITM && "bg-rose-50/10",
                          selectedStrike?.strike === strike && selectedStrike?.type === 'PE' && "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20"
                        )}
                      >
                        <motion.span 
                          animate={ltpUpdates[strike] ? { scale: [1, 1.05, 1], color: ['#18181b', '#e11d48', '#18181b'] } : {}}
                          className="text-[13px] font-bold text-zinc-900"
                        >
                          {putLtp.toFixed(2)}
                        </motion.span>
                        <span className={cn("text-[9px] font-medium", putChange >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {putChange >= 0 ? '+' : ''}{putChange.toFixed(2)}%
                        </span>
                      </div>

                      {/* Floating ATM Label - Only on ATM row */}
                      {isATM && (
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-50">
                          <div className="bg-black text-white px-3 py-1 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap border border-white/10">
                            <span className="text-[10px] font-black tracking-tight">
                              {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="text-zinc-700" size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No Data Available</p>
                    <p className="text-[9px] text-zinc-600 font-medium px-12">Option chain data is only available during market hours or if Upstox is connected.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 bg-zinc-50 min-h-full pt-3">
            {/* Constituents List - Light Theme */}
            <div className="px-5 space-y-2.5">
              <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Constituents</h3>
              {constituents.map(symbol => (
                <div key={symbol} className="bg-white border border-zinc-200 rounded-xl p-3.5 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-[11px] text-zinc-400">
                      {symbol.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-zinc-900 tracking-tight">{symbol}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase">NSE</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-zinc-900">{formatCurrency(stocks[symbol] || 2500)}</p>
                    <p className="text-[9px] font-bold text-emerald-600">+1.45%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Simplified Bottom Navigation for Index Detail */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-3.5 flex gap-2.5 z-[60]">
        <AnimatePresence mode="wait">
          {selectedStrike ? (
            <motion.div 
              key="trade-actions"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="flex-1 flex gap-3"
            >
              <button 
                onClick={() => onPlaceOrder({
                  side: 'SELL',
                  symbol: indexName,
                  strike: selectedStrike.strike,
                  optionType: selectedStrike.type,
                  expiry,
                  price: selectedStrike.price
                })}
                className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                SELL
              </button>
              <button 
                onClick={() => onPlaceOrder({
                  side: 'BUY',
                  symbol: indexName,
                  strike: selectedStrike.strike,
                  optionType: selectedStrike.type,
                  expiry,
                  price: selectedStrike.price
                })}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                BUY
              </button>
            </motion.div>
          ) : (
            <button 
              key="jump-to-atm-btn"
              onClick={jumpToATM}
              className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
            >
              Jump to ATM
            </button>
          )}
        </AnimatePresence>
        <button className="w-12 h-12 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors">
          <BarChart3 size={20} />
        </button>
      </div>
    </motion.div>
  );
};

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
            className="fixed inset-0 z-[60] bg-black p-6 flex flex-col"
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

              <div className="h-80 bg-zinc-900/50 rounded-[32px] border border-zinc-800/50 relative overflow-hidden">
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


const FullChartModal = ({ instrument, onClose }: { instrument: any, onClose: () => void }) => {
  const [timeframe, setTimeframe] = useState('5m');
  const [price, setPrice] = useState(instrument.ltp);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev: number) => prev + (Math.random() - 0.5) * 2);
    }, 2000); // Reduced frequency to prevent excessive re-renders
    return () => clearInterval(interval);
  }, []);

  // Mock data for candlestick
  const chartData = Array.from({ length: 40 }).map((_, i) => {
    const base = instrument.ltp + Math.sin(i / 5) * 20;
    return {
      time: i,
      open: base,
      high: base + Math.random() * 5,
      low: base - Math.random() * 5,
      close: base + (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 1000),
      ema: base + 2,
      vwap: base - 1
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">{instrument.symbol}</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Chart • {timeframe}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-black tracking-tighter", price >= instrument.avgPrice ? "text-emerald-500" : "text-rose-500")}>
            {formatCurrency(price)}
          </p>
          <p className="text-[10px] font-bold text-zinc-500">{(Math.random() * 2).toFixed(2)}%</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-zinc-900 flex justify-between items-center overflow-x-auto scrollbar-hide gap-4">
        <div className="flex gap-1">
          {['1m', '5m', '15m', '1h', '1D'].map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                timeframe === tf ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[8px] font-black text-blue-500 uppercase">EMA</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[8px] font-black text-amber-500 uppercase">VWAP</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        <ErrorBoundary>
          <TradingViewWidget symbol={instrument.symbol} />
        </ErrorBoundary>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
        <button className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10 uppercase text-xs tracking-widest">SELL</button>
        <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10 uppercase text-xs tracking-widest">BUY</button>
      </div>
    </motion.div>
  );
};

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
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const fetchPositions = async () => {
      try {
        const res = await fetch('/api/portfolio/positions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPositions(Array.isArray(data) ? data : []);
        }
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
            <div key={m.label} className="min-w-[120px] bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 space-y-0.5">
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{m.label} Margin</p>
              <p className={cn("text-[12px] font-black tracking-tight", m.color)}>{formatCurrency(m.value)}</p>
            </div>
          ))}
        </div>
      </div>

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
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
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

const Portfolio = ({ stocks }: { stocks: Record<string, number> }) => {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const fetchHoldings = async () => {
      try {
        const res = await fetch('/api/portfolio/holdings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHoldings(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch portfolio', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, []);

  const totalInvested = holdings.reduce((acc, h) => acc + (h.quantity * h.average_price), 0);
  const currentValue = holdings.reduce((acc, h) => acc + (h.quantity * (stocks[h.symbol] || h.average_price)), 0);
  const totalPnL = currentValue - totalInvested;
  const dayPnL = totalPnL * 0.05; // Simulated day P&L

  const allocationData = holdings.length > 0 ? holdings.map(h => ({
    name: h.symbol,
    value: h.quantity * (stocks[h.symbol] || h.average_price)
  })) : [{ name: 'Cash', value: user?.balance || 0 }];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const mfHoldings = [
    { name: 'Quant Small Cap Fund', amount: 45000, pnl: 12400, type: 'Equity' },
    { name: 'Parag Parikh Flexi Cap', amount: 85000, pnl: 18500, type: 'Equity' },
  ];

  const sipInvestments = [
    { name: 'HDFC Index Fund Nifty 50', amount: 5000, date: '05 Mar 2026' },
    { name: 'ICICI Prudential Bluechip', amount: 3000, date: '12 Mar 2026' },
  ];

  return (
    <div className="space-y-5 pb-24 overflow-y-auto scroll-smooth">
      {/* Portfolio Summary */}
      <div className="px-5 pt-4">
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Portfolio Value</p>
            <h2 className="text-3xl font-black tracking-tighter text-white">{formatCurrency(currentValue + (user?.balance || 0))}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6 pt-5 border-t border-zinc-800/50">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Overall P&L</p>
              <p className={cn("text-base font-bold", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Day P&L</p>
              <p className={cn("text-base font-bold", dayPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {dayPnL >= 0 ? '+' : ''}{formatCurrency(dayPnL)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Portfolio Analytics</h3>
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-5 space-y-5">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {allocationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '9px', fontWeight: 'bold' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/50">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Risk Score</p>
              <div className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-500 uppercase">Moderate</span>
              </div>
            </div>
            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/50">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Sector Exposure</p>
              <div className="flex items-center gap-1.5">
                <BarChart3 size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold text-white uppercase">IT & Banking</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Equity Holdings */}
      <div className="px-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Equity Holdings</h3>
          <span className="text-[9px] font-bold text-zinc-700">{holdings.length} Stocks</span>
        </div>
        <div className="space-y-2.5">
          {holdings.map(h => {
            const currentPrice = stocks[h.symbol] || h.average_price;
            const pnl = (currentPrice - h.average_price) * h.quantity;
            return (
              <div key={h.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                    {h.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white tracking-tight">{h.symbol}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{h.quantity} Qty • Avg {formatCurrency(h.average_price)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-white">{formatCurrency(h.quantity * currentPrice)}</p>
                  <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mutual Funds */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Mutual Funds</h3>
        <div className="space-y-2.5">
          {mfHoldings.map((mf, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-white tracking-tight">{mf.name}</p>
                <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{mf.type} • Invested {formatCurrency(mf.amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(mf.amount + mf.pnl)}</p>
                <p className="text-[9px] font-bold text-emerald-500">+{formatCurrency(mf.pnl)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SIP Investments */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">SIP Investments</h3>
        <div className="space-y-2.5">
          {sipInvestments.map((sip, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{sip.name}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">Monthly {formatCurrency(sip.amount)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Next SIP</p>
                <p className="text-[11px] font-bold text-white mt-0.5">{sip.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Transaction History</h3>
        <div className="space-y-2.5">
          {[
            { type: 'Deposit', amount: 50000, date: '25 Feb 2026', status: 'Success' },
            { type: 'Buy', amount: 12450, date: '22 Feb 2026', status: 'Success', symbol: 'TCS' },
            { type: 'Withdraw', amount: 5000, date: '18 Feb 2026', status: 'Success' },
          ].map((tx, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", tx.type === 'Deposit' ? "bg-emerald-500/10 text-emerald-500" : tx.type === 'Withdraw' ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500")}>
                  {tx.type === 'Deposit' ? <Plus size={16} /> : tx.type === 'Withdraw' ? <Minus size={16} /> : <ArrowRightLeft size={16} />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{tx.type} {tx.symbol ? `• ${tx.symbol}` : ''}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(tx.amount)}</p>
                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">{tx.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Onboarding = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  return (
    <div className="min-h-screen bg-black p-8 space-y-10 pb-32">
      <div className="space-y-3 pt-12">
        <h2 className="text-3xl font-black tracking-tighter text-white">Demat Onboarding</h2>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
          Step {step} of 4: <span className="text-emerald-500">{step === 1 ? 'PAN Verification' : step === 2 ? 'Aadhaar eKYC' : step === 3 ? 'Bank Linking' : 'IPV Verification'}</span>
        </p>
      </div>
      
      <div className="flex gap-2">
        {[1,2,3,4].map(s => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", s <= step ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-zinc-900")} />
        ))}
      </div>

      <motion.div 
        key={step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">PAN Number</label>
              <input type="text" placeholder="ABCDE1234F" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm uppercase font-bold tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Date of Birth</label>
              <input type="date" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">We will securely redirect you to Digilocker for Aadhaar eKYC verification.</p>
            <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl mx-auto flex items-center justify-center">
                <ShieldCheck className="text-emerald-500" size={40} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Secure Verification</p>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Powered by Digilocker</p>
              </div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Account Number</label>
              <input type="text" placeholder="000000000000" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">IFSC Code</label>
              <input type="text" placeholder="HDFC0001234" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm uppercase font-bold tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-6">
            <div className="aspect-video bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 flex items-center justify-center relative overflow-hidden group">
              <UserIcon size={64} className="text-zinc-800 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 bg-zinc-900/80 backdrop-blur-xl p-4 rounded-2xl border border-zinc-800/50">
                <p className="text-[10px] font-bold text-white text-center uppercase tracking-widest">Record a 5-second video saying "1234"</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4 z-50">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 bg-zinc-900 text-zinc-400 font-bold py-5 rounded-2xl border border-zinc-800 hover:text-white transition-all uppercase text-[10px] tracking-widest">Back</button>
        )}
        <button 
          onClick={() => step < 4 ? setStep(step + 1) : onComplete()} 
          className="flex-1 bg-emerald-500 text-black font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all uppercase text-[10px] tracking-widest"
        >
          {step === 4 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  return (
    <div className="p-6 space-y-8 pb-24">
      <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Users', value: '12,450', change: '+12%' },
          { label: 'Revenue', value: '₹4.2L', change: '+8%' },
          { label: 'Active Trades', value: '1,205', change: '+15%' },
          { label: 'KYC Pending', value: '45', change: '-5%' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
            <p className="text-[10px] font-bold text-emerald-500 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Recent KYC Requests</h3>
        {[1,2,3].map(i => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">JD</div>
              <div>
                <p className="text-xs font-bold">User #{1000 + i}</p>
                <p className="text-[10px] text-zinc-500">2 mins ago</p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-emerald-500 uppercase">Approve</button>
          </div>
        ))}
      </div>
    </div>
  );
};

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
              <p className="text-[10px] text-zinc-400 font-medium leading-tight max-w-[200px]">{signal.reason}</p>
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

const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'whitelist' | 'users'>('whitelist');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ email: '', mobile: '', password: '', role: 'user' });
  const { token } = useAuthStore();

  const fetchWhitelist = async () => {
    try {
      const res = await fetch('/api/admin/whitelist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWhitelist(data);
      }
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchWhitelist();
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm)
      });
      if (res.ok) {
        setNewUserForm({ email: '', mobile: '', password: '', role: 'user' });
        setShowCreateUser(false);
        fetchUsers();
        toast.success('User created successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create user');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentifier) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ identifier: newIdentifier })
      });
      if (res.ok) {
        setNewIdentifier('');
        fetchWhitelist();
        toast.success('User added to whitelist');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add user');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/whitelist/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchWhitelist();
        toast.success('User removed from whitelist');
      }
    } catch (e) {}
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
        toast.success(`User role updated to ${newRole}`);
      }
    } catch (e) {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-8 pb-24">
      <div className="flex items-center gap-4 pt-10">
        <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Admin Panel</h2>
      </div>

      {/* Admin Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800/50">
        <button 
          onClick={() => setActiveAdminTab('whitelist')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeAdminTab === 'whitelist' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
          )}
        >
          Whitelist
        </button>
        <button 
          onClick={() => setActiveAdminTab('users')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeAdminTab === 'users' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
          )}
        >
          Users
        </button>
      </div>

      <div className="space-y-6">
        {activeAdminTab === 'whitelist' ? (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Beta Whitelist Management</h3>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Email or Mobile" 
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-emerald-500 text-black font-black px-6 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                Add
              </button>
            </form>
            
            <div className="space-y-2 pt-2">
              {whitelist.map(item => (
                <div key={item.id} className="bg-black/40 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-white">{item.identifier}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Added: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <LogOut size={16} className="rotate-90" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">User Management</h3>
              <button 
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
              >
                {showCreateUser ? 'Cancel' : 'Create User'}
              </button>
            </div>

            <AnimatePresence>
              {showCreateUser && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCreateUser}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="email" 
                      placeholder="Email" 
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Mobile" 
                      required
                      value={newUserForm.mobile}
                      onChange={(e) => setNewUserForm({...newUserForm, mobile: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="password" 
                      placeholder="Password" 
                      required
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                    <select 
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-emerald-500 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all"
                  >
                    Create User Account
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="bg-black/40 border border-zinc-800/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{u.email}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{u.mobile || 'No Mobile'}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                      u.role === 'admin' ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {u.role}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest">
                      Balance: <span className="text-white">₹{(u.balance || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      {u.role === 'user' ? (
                        <button 
                          onClick={() => handleUpdateRole(u.id, 'admin')}
                          className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:underline"
                        >
                          Make Admin
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateRole(u.id, 'user')}
                          className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:underline"
                        >
                          Make User
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ComplianceDetail = ({ type, onBack }: { type: string, onBack: () => void }) => {
  const content: Record<string, { title: string, text: string }> = {
    'SEBI Disclaimer': {
      title: 'SEBI Disclaimer',
      text: 'Investment in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.'
    },
    'Risk Disclosure': {
      title: 'Risk Disclosure',
      text: 'Trading in derivatives (Futures and Options) involves significant risk and is not suitable for all investors. 9 out of 10 individual traders in equity Futures and Options Segment, incurred net losses. On an average, loss makers registered net loss close to ₹50,000.'
    },
    'Terms & Conditions': {
      title: 'Terms & Conditions',
      text: 'By using Aapa Capital, you agree to our terms of service. We provide a platform for trading and do not provide financial advice. All trades are executed at your own risk. Brokerage and other charges apply as per the fee schedule.'
    }
  };

  const data = content[type] || { title: 'Compliance', text: 'Information not available.' };

  return (
    <div className="min-h-screen bg-black p-8 space-y-8 pb-24">
      <div className="flex items-center gap-4 pt-12">
        <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <h2 className="text-2xl font-black tracking-tighter text-white">{data.title}</h2>
      </div>
      <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-8">
        <p className="text-sm text-zinc-400 leading-relaxed font-medium">{data.text}</p>
      </div>
      <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-center">I have read and understood the disclosure</p>
      </div>
    </div>
  );
};

const More = ({ 
  activeTab, 
  setActiveTab, 
  setComplianceType, 
  setStocks,
  onConnectAngel,
  onConnectUptox,
  isConnectingAngel,
  isConnectingUptox,
  debugInfo,
  isRefreshing,
  onForceRefresh
}: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  setComplianceType: (t: string) => void, 
  setStocks: (s: Record<string, number>) => void,
  onConnectAngel: () => void,
  onConnectUptox: () => void,
  isConnectingAngel: boolean,
  isConnectingUptox: boolean,
  debugInfo: any,
  isRefreshing: boolean,
  onForceRefresh: () => void
}) => {
  const { user, token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.id) {
          setAuth(data, token);
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, [token]);

  const allSections = [
    {
      title: 'Debug Info (Internal)',
      items: [
        { 
          icon: Activity, 
          label: 'Market Data Status', 
          status: debugInfo?.is_fetching ? 'Active' : 'Idle', 
          color: debugInfo?.is_fetching ? 'text-emerald-500' : 'text-zinc-500' 
        },
        { 
          icon: ShieldCheck, 
          label: 'Tokens in DB', 
          status: `${debugInfo?.token_count || 0} users`, 
          color: 'text-zinc-500' 
        },
        {
          icon: ShieldCheck,
          label: 'API Key Configured',
          status: debugInfo?.api_key_set ? 'Yes' : 'No (Check .env)',
          color: debugInfo?.api_key_set ? 'text-emerald-500' : 'text-rose-500'
        },
        {
          icon: Info,
          label: 'Redirect URI',
          status: `${window.location.origin}/auth/callback`,
          color: 'text-zinc-500',
          copy: true
        },
        { 
          icon: Info, 
          label: 'Last NIFTY Price', 
          status: debugInfo?.last_prices?.['NIFTY 50'] || '0.00', 
          color: 'text-zinc-500' 
        },
        { 
          icon: History, 
          label: 'Force Refresh Data', 
          status: isRefreshing ? 'Refreshing...' : 'Click to Sync', 
          color: 'text-blue-500',
          action: onForceRefresh,
          loading: isRefreshing
        },
      ]
    },
    {
      title: 'Account',
      items: [
        { icon: UserIcon, label: 'Profile Details', status: 'Active', color: 'text-emerald-500' },
        { icon: ShieldCheck, label: 'KYC Status', status: 'Pending', color: 'text-amber-500', action: () => setActiveTab('onboarding') },
        { icon: Wallet, label: 'Funds & Withdrawals', status: '', color: 'text-blue-500' },
        { 
          icon: Zap, 
          label: 'Connect Angel One', 
          status: user?.is_angelone_connected ? 'Linked' : 'Not Linked', 
          color: user?.is_angelone_connected ? 'text-emerald-500' : 'text-zinc-500',
          action: user?.is_angelone_connected ? undefined : onConnectAngel,
          loading: isConnectingAngel
        },
        { 
          icon: Zap, 
          label: 'Connect Upstox', 
          status: user?.is_uptox_connected ? 'Linked' : 'Not Linked', 
          color: user?.is_uptox_connected ? 'text-emerald-500' : 'text-zinc-500',
          action: user?.is_uptox_connected ? undefined : onConnectUptox,
          loading: isConnectingUptox
        },
      ]
    },
    {
      title: 'Subscription',
      items: [
        { icon: Zap, label: 'Membership Plans', status: 'Free', color: 'text-purple-500' },
        { icon: Users, label: 'Refer & Earn', status: '₹500/ref', color: 'text-pink-500' },
      ]
    },
    {
      title: 'Security & App',
      items: [
        { icon: Settings, label: 'App Settings', status: '', color: 'text-zinc-500' },
        { icon: ShieldCheck, label: 'Security Settings', status: '', color: 'text-zinc-500' },
        { icon: HelpCircle, label: 'Help & Support', status: '', color: 'text-zinc-500' },
        ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Admin Panel', status: 'Staff', color: 'text-rose-500', action: () => setActiveTab('admin') }] : []),
      ]
    },
    {
      title: 'Compliance',
      items: [
        { icon: Info, label: 'SEBI Disclaimer', status: '', color: 'text-zinc-600', action: () => { setComplianceType('SEBI Disclaimer'); setActiveTab('compliance'); } },
        { icon: AlertTriangle, label: 'Risk Disclosure', status: '', color: 'text-zinc-600', action: () => { setComplianceType('Risk Disclosure'); setActiveTab('compliance'); } },
        { icon: FileText, label: 'Terms & Conditions', status: '', color: 'text-zinc-600', action: () => { setComplianceType('Terms & Conditions'); setActiveTab('compliance'); } },
      ]
    }
  ];

  // Filter sections for non-admin users
  const sections = user?.role === 'admin' 
    ? allSections 
    : allSections
        .filter(s => ['Account', 'Subscription', 'Security & App', 'Compliance'].includes(s.title));

  return (
    <div className="space-y-8 pb-24">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-4 pt-10">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 p-1 shadow-2xl shadow-emerald-500/20">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
              <UserIcon size={40} className="text-zinc-800" />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full border-4 border-black flex items-center justify-center">
            <ShieldCheck size={12} className="text-black" strokeWidth={3} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{user?.email.split('@')[0]}</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Client ID: AAPA-{user?.id}001</p>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-6 space-y-8">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map((item: any, iIdx: number) => (
                <button 
                  key={iIdx} 
                  onClick={item.action}
                  disabled={item.loading || (item.label === 'Uptox Account' && user?.is_uptox_connected)}
                  className="w-full bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-zinc-900/50", item.color)}>
                      {item.loading ? <Activity size={20} className="animate-pulse" /> : <item.icon size={20} />}
                    </div>
                    <span className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.status && (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate max-w-[120px]", 
                        item.color
                      )}>
                        {item.status}
                      </span>
                    )}
                    {item.copy ? (
                      <div 
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.status);
                          toast.success('Copied to clipboard!');
                        }}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <FileText size={14} />
                      </div>
                    ) : !user?.is_uptox_connected && item.label === 'Uptox Account' ? (
                      <div className="bg-emerald-500 text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Link</div>
                    ) : (
                      <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6">
        <button 
          onClick={logout}
          className="w-full bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-black border border-rose-500/10 font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>

      <div className="text-center opacity-30 pb-10">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Aapa Capital v1.0.0 • SEBI INZ000123456</p>
      </div>
    </div>
  );
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[Auth] Submitting ${isLogin ? 'login' : 'registration'} form...`);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { login: email, password } : { email, mobile, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Server returned an error' }));
        console.error('[Auth] Request failed:', errorData);
        toast.error(errorData.error || 'Something went wrong');
        return;
      }

      const data = await res.json();
      console.log('[Auth] Response received:', data);
      
      if (data.token) {
        setAuth(data.user, data.token);
      } else if (!isLogin && data.id) {
        setIsLogin(true);
        toast.success('Account created! Please sign in.');
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch (err: any) {
      console.error('[Auth] Network or parsing error:', err);
      toast.error('Failed to connect to server. Please check your connection.');
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#111827] px-4 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center flex flex-col items-center"
      >
        <div className="relative flex flex-col items-center mb-6">
          <img 
            src="/aapa-logo.png" 
            alt="Aapa Logo" 
            className="w-48 block mx-auto mb-2 object-contain mix-blend-lighten"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-3xl font-extrabold tracking-wide leading-tight">
            <span className="text-white">{isAdminLogin && isLogin ? 'ADMIN ' : 'AAPA '}</span>
            <span className="text-emerald-500">{isAdminLogin && isLogin ? 'ACCESS' : 'CAPITAL'}</span>
          </h1>
          <p className="text-[10px] text-gray-400 mt-1 tracking-[3px]">
            {isAdminLogin && isLogin ? 'MANAGE PLATFORM' : 'TRADE FEARLESS WITH AAPA'}
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md text-left w-full">
          {isLogin && (
            <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800/50 mb-8">
              <button 
                onClick={() => setIsAdminLogin(false)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  !isAdminLogin ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                User
              </button>
              <button 
                onClick={() => setIsAdminLogin(true)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  isAdminLogin ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                Admin
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  {isLogin ? 'Email or Mobile' : 'Email Address'}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder={isLogin ? "Email or Mobile Number" : "name@example.com"}
                  required
                />
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="+91 00000 00000"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] mt-4"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="group text-[11px] font-bold text-zinc-400 uppercase tracking-widest transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-emerald-500 group-hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/30">Sign up</span></>
              ) : (
                <>Already have an account? <span className="text-emerald-500 group-hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/30">Sign in</span></>
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest leading-relaxed">
            By continuing, you agree to Aapa Capital's<br />
            <span className="text-zinc-500">Terms of Service</span> and <span className="text-zinc-500">Privacy Policy</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  console.log('[App] Rendering main App component, token exists:', !!useAuthStore.getState().token);
  const { token, user, setAuth, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stocks, setStocks] = useState<Record<string, number>>({
    "NIFTY 50": 22145.20,
    "SENSEX": 72850.40,
    "BANKNIFTY": 46800.15,
    "FINNIFTY": 20850.60,
    "RELIANCE": 2985.40,
    "TCS": 4120.15,
    "HDFCBANK": 1450.60,
    "INFY": 1680.40,
    "ICICIBANK": 1050.20
  });
  const [complianceType, setComplianceType] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [overviewIndex, setOverviewIndex] = useState<string | null>(null);
  const [orderConfig, setOrderConfig] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStockFromSearch, setSelectedStockFromSearch] = useState<string | null>(null);

  // Broker Connection Logic (Moved from More)
  const [isConnectingAngel, setIsConnectingAngel] = useState(false);
  const [isConnectingUptox, setIsConnectingUptox] = useState(false);
  const [angelForm, setAngelForm] = useState({ clientCode: '', password: '', totp: '' });
  const [showAngelLogin, setShowAngelLogin] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnectAngel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingAngel(true);
    try {
      const res = await fetch('/api/auth/angelone/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(angelForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Angel One connected successfully!');
        setShowAngelLogin(false);
        // Refresh profile
        const pRes = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const pData = await pRes.json();
        setAuth(pData, token);
      } else {
        toast.error(data.error || 'Angel One login failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsConnectingAngel(false);
    }
  };

  const handleConnectUptox = async () => {
    setIsConnectingUptox(true);
    const authWindow = window.open('about:blank', 'uptox_auth', 'width=500,height=600');
    try {
      const res = await fetch('/api/auth/uptox/url');
      const { url, error } = await res.json();
      if (url && authWindow) {
        authWindow.location.href = url;
      } else {
        authWindow?.close();
        toast.error(error || 'Uptox configuration missing on server');
      }
    } catch (e) {
      authWindow?.close();
      toast.error('Failed to get connection URL');
    } finally {
      setIsConnectingUptox(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/market/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStocks(data.last_prices);
          // Refresh debug info too
          const debugRes = await fetch('/api/market-status');
          if (debugRes.ok) {
            const debugData = await debugRes.json();
            setDebugInfo(debugData);
          }
        }
      }
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchDebug = async () => {
      try {
        const res = await fetch('/api/market-status');
        if (res.ok) {
          const data = await res.json();
          setDebugInfo(data);
        }
      } catch (e) {}
    };
    if (activeTab === 'more') fetchDebug();
  }, [activeTab]);

  // Admin Redirect Logic
  useEffect(() => {
    if (token && user?.role === 'admin' && activeTab === 'dashboard') {
      setActiveTab('admin');
    }
  }, [token, user?.role]);

  const openOptionChain = (index: string = 'NIFTY 50') => {
    setSelectedIndex(index);
  };

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return [];
    return Object.keys(stocks).filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8);
  }, [searchQuery, stocks]);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            logout();
          }
          return;
        }
        const data = await res.json();
        if (!data.id) {
          console.log('[App] Token invalid, logging out');
          logout();
        } else {
          setAuth(data, token);
        }
      } catch (e) {
        console.error('[App] Failed to verify token', e);
        // Don't logout on network error, only on 401/invalid data
      }
    };
    verifyToken();
  }, [token, logout, setAuth]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'UPTOX_AUTH_SUCCESS') {
        const { token: uptoxToken, refresh_token: uptoxRefreshToken } = event.data;
        if (!token) return;

        try {
          const res = await fetch('/api/auth/uptox/save-token', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              access_token: uptoxToken,
              refresh_token: uptoxRefreshToken
            })
          });
          
          if (res.ok) {
            // Refresh profile to update connection status
            const profileRes = await fetch('/api/user/profile', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.id) {
                setAuth(profileData, token);
              }
            }
          }
        } catch (e) {
          console.error('Failed to save Uptox token', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, setAuth]);

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[WebSocket] Connected to server');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ticker') {
          // Only log if data is non-zero to avoid spamming
          const hasData = Object.values(message.data).some(v => (v as number) > 0);
          if (hasData) {
            console.log('[WebSocket] Ticker received with live data');
          }
          setStocks(message.data);
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse message', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Connection error', err);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected from server');
    };

    return () => ws.close();
  }, [token]);

  if (!token) {
    return (
      <ErrorBoundary>
        <Auth />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-center" richColors />
      <Header 
        onProfileClick={() => setActiveTab('more')} 
        onSearchClick={() => setIsSearchOpen(true)}
      />
      
      <main className="max-w-md mx-auto pt-20">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard 
              key="dashboard" 
              stocks={stocks} 
              onMarketClick={() => setActiveTab('market')} 
              onIndexClick={setSelectedIndex} 
              onProfileClick={() => setActiveTab('more')}
            />
          )}
          {activeTab === 'market' && (
            <Market 
              key="market" 
              stocks={stocks} 
              onIndexClick={setOverviewIndex} 
              onPlaceOrder={setOrderConfig}
              initialSelectedStock={selectedStockFromSearch}
            />
          )}
          {activeTab === 'fo' && (
            <div className="space-y-6">
              <OptionChain onPlaceOrder={setOrderConfig} stocks={stocks} fullChain={false} />
              <FOTradingCenter 
                key="fo" 
                stocks={stocks} 
                onOpenOptionChain={() => openOptionChain()} 
                onConnectAngel={() => setShowAngelLogin(true)}
                onConnectUptox={handleConnectUptox}
                isConnectingAngel={isConnectingAngel}
                isConnectingUptox={isConnectingUptox}
              />
            </div>
          )}
          {activeTab === 'portfolio' && <Portfolio key="portfolio" stocks={stocks} />}
          {activeTab === 'onboarding' && <Onboarding key="onboarding" onComplete={() => setActiveTab('dashboard')} />}
          {activeTab === 'admin' && <AdminPanel key="admin" onBack={() => setActiveTab('dashboard')} />}
          {activeTab === 'more' && (
            <More 
              key="more" 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              setComplianceType={setComplianceType} 
              setStocks={setStocks} 
              onConnectAngel={() => setShowAngelLogin(true)}
              onConnectUptox={handleConnectUptox}
              isConnectingAngel={isConnectingAngel}
              isConnectingUptox={isConnectingUptox}
              debugInfo={debugInfo}
              isRefreshing={isRefreshing}
              onForceRefresh={handleForceRefresh}
            />
          )}
          {activeTab === 'compliance' && <ComplianceDetail key="compliance" type={complianceType} onBack={() => setActiveTab('more')} />}
        </AnimatePresence>
      </main>

      {/* Angel One Login Modal (Moved to App) */}
      <AnimatePresence>
        {showAngelLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Angel One Login</h3>
                <button onClick={() => setShowAngelLogin(false)} className="p-2 text-zinc-500 hover:text-white">
                  <LogOut size={20} className="rotate-90" />
                </button>
              </div>
              <form onSubmit={handleConnectAngel} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Client Code</label>
                  <input 
                    type="text" 
                    required
                    value={angelForm.clientCode}
                    onChange={(e) => setAngelForm({...angelForm, clientCode: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="e.g. V123456"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={angelForm.password}
                    onChange={(e) => setAngelForm({...angelForm, password: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">TOTP / OTP</label>
                  <input 
                    type="text" 
                    required
                    value={angelForm.totp}
                    onChange={(e) => setAngelForm({...angelForm, totp: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="6-digit code"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isConnectingAngel}
                  className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isConnectingAngel ? 'Connecting...' : 'Link Account'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isSearchOpen && (
          <motion.div 
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setIsSearchOpen(false)} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 text-zinc-400">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search Stocks, Indices, F&O..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {filteredStocks.length > 0 ? (
                filteredStocks.map(symbol => (
                  <div 
                    key={symbol} 
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSelectedStockFromSearch(symbol);
                      setActiveTab('market');
                    }}
                    className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-xs text-zinc-500">
                        {symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white tracking-tight">{symbol}</p>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase">NSE • Equity</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(stocks[symbol] || 0)}</p>
                      <p className="text-[10px] font-bold text-emerald-500">+1.24%</p>
                    </div>
                  </div>
                ))
              ) : searchQuery ? (
                <div className="text-center py-20">
                  <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">No results found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Recent Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {['RELIANCE', 'NIFTY 50', 'TCS', 'ZOMATO'].map(s => (
                      <button key={s} onClick={() => setSearchQuery(s)} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-colors">{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {orderConfig && (
          <OrderWindow 
            key="order-window"
            config={orderConfig} 
            onClose={() => setOrderConfig(null)} 
            onOrderPlaced={() => {
              // Refresh portfolio or show success
            }}
          />
        )}
        {overviewIndex && (
          <IndexOverview 
            key="index-overview"
            indexName={overviewIndex}
            stocks={stocks}
            onClose={() => setOverviewIndex(null)}
            onOpenOptionChain={() => {
              setSelectedIndex(overviewIndex);
              setOverviewIndex(null);
            }}
          />
        )}
        {selectedIndex && (
          <IndexDetail 
            key="index-detail"
            indexName={selectedIndex} 
            stocks={stocks} 
            onClose={() => setSelectedIndex(null)} 
            onPlaceOrder={setOrderConfig}
          />
        )}
      </AnimatePresence>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
    </ErrorBoundary>
  );
}
