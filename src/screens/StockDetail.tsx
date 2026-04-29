// src/screens/StockDetail.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Activity, Plus, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import UpstoxNativeChart, { ChartError } from '../components/UpstoxNativeChart';
import ErrorBoundary from '../components/ErrorBoundary';
import { useWatchlists } from '../components/WatchlistManager';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

// ── Index detection ────────────────────────────────────────────────────────────
const INDEX_KEYWORDS = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCAP', 'SMALLCAP'];
const isIndexSymbol = (sym: string): boolean => {
  const upper = sym.toUpperCase();
  if (upper.includes(' ')) return true;
  return INDEX_KEYWORDS.some((kw) => upper === kw || upper.startsWith(kw + '_'));
};

// ── Instrument-key resolution (equity only) ────────────────────────────────────
const getUpstoxInstrumentKey = (symbol: string, quote: any): string => {
  if (symbol.includes('|')) return symbol;
  if (quote && typeof quote !== 'number' && quote.instrument_token) return quote.instrument_token;
  return `NSE_EQ|${symbol}`;
};

type Props = {
  symbol: string;
  stocks: Record<string, any>;
  onClose: () => void;
  onPlaceOrder: (config: any) => void;
  onNavigateToIndex?: (symbol: string) => void; // NEW
  onConnectBroker?: () => void;                 // NEW
};

const StockDetail: React.FC<Props> = ({
  symbol, stocks, onClose, onPlaceOrder, onNavigateToIndex, onConnectBroker,
}) => {
  const { user } = useAuthStore();
  const wl = useWatchlists();

  const [isUpstoxConnected, setIsUpstoxConnected] = useState<boolean | null>(null);
  const [chartError, setChartError] = useState<ChartError | null>(null);

  // Check broker connection
  useEffect(() => {
    if (user?.is_uptox_connected !== undefined) {
      setIsUpstoxConnected(!!user.is_uptox_connected);
      return;
    }
    apiClient.get('/api/user/brokers')
      .then((res) => {
        const upstox = res.data?.brokers?.find((b: any) => b.broker === 'upstox');
        setIsUpstoxConnected(!!upstox?.is_connected);
      })
      .catch(() => setIsUpstoxConnected(false));
  }, [user]);

  // Route index symbols away
  useEffect(() => {
    if (isIndexSymbol(symbol)) {
      onNavigateToIndex?.(symbol);
      onClose();
    }
  }, [symbol]);

  const currentItems = wl.activeWatchlist?.items ?? [];
  const existingSymbols = currentItems.map((i) => i.symbol);
  const quote = stocks[symbol];
  const ltp = typeof quote === 'number' ? quote : (quote?.ltp ?? 0);
  const change = typeof quote === 'number' ? 0 : (quote?.day_change ?? 0);
  const changePct = typeof quote === 'number' ? 0 : (quote?.day_change_pct ?? 0);
  const isPositive = change >= 0;
  const instrumentKey = getUpstoxInstrumentKey(symbol, quote);

  const toggleWatchlist = async () => {
    if (!wl.activeId) return;
    const alreadyIn = existingSymbols.includes(symbol);
    if (alreadyIn) {
      const item = currentItems.find((i) => i.symbol === symbol);
      if (item) await wl.removeSymbol(wl.activeId, item.id);
    } else {
      await wl.addSymbol(wl.activeId, symbol);
    }
  };

  const renderChart = () => {
    // Still checking connection
    if (isUpstoxConnected === null) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      );
    }

    // Not connected → show CTA card
    if (!isUpstoxConnected) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4 px-6 text-center">
          <WifiOff size={30} className="text-zinc-500" />
          <p className="text-sm font-bold text-zinc-300">Connect Upstox to view live chart</p>
          <p className="text-[11px] text-zinc-500">
            Historical candlestick data requires an active Upstox broker connection.
          </p>
          {onConnectBroker && (
            <button
              onClick={onConnectBroker}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-3 px-5 rounded-2xl transition-all"
            >
              <Wifi size={14} /> Connect Upstox
            </button>
          )}
        </div>
      );
    }

    // Token expired mid-session
    if (chartError && (chartError.type === 'no_broker' || chartError.type === 'invalid_token')) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4 px-6 text-center">
          <WifiOff size={30} className="text-zinc-500" />
          <p className="text-sm font-bold text-zinc-300">{chartError.message}</p>
          {onConnectBroker && (
            <button
              onClick={onConnectBroker}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-3 px-5 rounded-2xl transition-all"
            >
              <RefreshCw size={14} /> Reconnect Upstox
            </button>
          )}
        </div>
      );
    }

    // Normal — chart renders with its own api_error/no_data states
    return (
      <ErrorBoundary>
        <UpstoxNativeChart
          symbol={symbol}
          instrumentToken={instrumentKey}
          onError={(err) => setChartError(err)}
        />
      </ErrorBoundary>
    );
  };

  return (
    <motion.div
      key="stock-detail"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      className="fixed inset-0 z-60 bg-black p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button onClick={onClose} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight">{symbol}</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase">NSE • EQUITY</p>
        </div>
        <button
          onClick={toggleWatchlist}
          className={cn('p-3 rounded-2xl transition-all',
            existingSymbols.includes(symbol) ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-zinc-400'
          )}
        >
          <Plus size={24} className={cn(existingSymbols.includes(symbol) && 'rotate-45')} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">
        <div className="text-center">
          <p className="text-5xl font-bold tracking-tighter mb-2">{formatCurrency(ltp)}</p>
          <p className={cn('text-sm font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
            {isPositive && change !== 0 ? '+' : ''}{formatCurrency(Math.abs(change))} (
            {isPositive && changePct !== 0 ? '+' : ''}{changePct.toFixed(2)}%) Today
          </p>
        </div>

        <div className="h-80 bg-zinc-900/50 rounded-4xl border border-zinc-800/50 relative overflow-hidden">
          {renderChart()}
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity size={18} />
            <h4 className="text-xs font-bold uppercase tracking-widest">Technical Overview</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'RSI (14)', value: '58.42', sub: 'Neutral', color: 'text-white' },
              { label: 'MACD', value: 'Bullish', sub: 'Crossover', color: 'text-emerald-500' },
              { label: '200 DMA', value: (ltp * 0.92).toFixed(2), sub: '', color: 'text-white' },
              { label: '52W High', value: (ltp * 1.15).toFixed(2), sub: '', color: 'text-white' },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{item.label}</p>
                <p className={cn('text-sm font-bold', item.color)}>
                  {item.value}
                  {item.sub && <span className="text-[10px] text-zinc-500 font-medium ml-1">{item.sub}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
        <button
          onClick={() => onPlaceOrder({ side: 'SELL', symbol, price: ltp })}
          className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10"
        >SELL</button>
        <button
          onClick={() => onPlaceOrder({ side: 'BUY', symbol, price: ltp })}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10"
        >BUY</button>
      </div>
    </motion.div>
  );
};

export default StockDetail;