// src/screens/StockDetail.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Activity, Plus, Wifi, WifiOff, RefreshCw, Camera, Radio } from 'lucide-react';
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

// ── Helper: does stocks map have a usable live price? ─────────────────────────
const hasLivePrice = (quote: any): boolean => {
  if (quote === undefined || quote === null) return false;
  const ltpVal = typeof quote === 'number' ? quote : (quote?.ltp ?? 0);
  return ltpVal > 0;
};

type Props = {
  symbol: string;
  stocks: Record<string, any>;
  onClose: () => void;
  onPlaceOrder: (config: any) => void;
  onNavigateToIndex?: (symbol: string) => void;
  onConnectBroker?: () => void;
  /** Optional: lets parent merge snapshot price into global stocks state */
  onSnapshotResolved?: (symbol: string, normalizedQuote: any) => void;
};

const StockDetail: React.FC<Props> = ({
  symbol, stocks, onClose, onPlaceOrder,
  onNavigateToIndex, onConnectBroker, onSnapshotResolved,
}) => {
  const { user } = useAuthStore();
  const wl = useWatchlists();

  const [isUpstoxConnected, setIsUpstoxConnected] = useState<boolean | null>(null);
  const [chartError, setChartError] = useState<ChartError | null>(null);

  // ── Snapshot state ────────────────────────────────────────────────────────────
  const [snapshotQuote, setSnapshotQuote] = useState<any>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);
  const [isSnapshotMode, setIsSnapshotMode] = useState(false);

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

  // ── Snapshot fetch: fires when symbol has no live price ───────────────────────
  useEffect(() => {
    if (isIndexSymbol(symbol)) return;
    if (hasLivePrice(stocks[symbol])) {
      setIsSnapshotMode(false);
      return;
    }

    const instrKey = getUpstoxInstrumentKey(symbol, null);
    setSnapshotLoading(true);
    setSnapshotError(false);
    setSnapshotQuote(null);

    apiClient
      .get('/api/broker/upstox/market/snapshot', {
        params: { instrument_key: instrKey },
      })
      .then((res) => {
        const data = res.data;

        // Handle multiple backend response shapes robustly:
        //  A: { prices: { WIPRO: { ltp, day_change, day_change_pct } } }
        //  B: { data: { 'NSE_EQ|WIPRO': { ltp, net_change, percent_change } } }
        //  C: { WIPRO: { ltp, ... } }
        //  D: { data: { WIPRO: { ltp, ... } } }
        let q: any =
          data?.prices?.[symbol] ||
          data?.data?.[instrKey] ||
          data?.[symbol] ||
          data?.data?.[symbol];

        // Last resort: scan data.data keys for key containing the symbol
        if (!q && data?.data && typeof data.data === 'object') {
          const matchKey = Object.keys(data.data).find((k) =>
            k.toUpperCase().includes(symbol.toUpperCase()),
          );
          if (matchKey) q = data.data[matchKey];
        }

        if (q) {
          const normalized = {
            ltp: q.ltp ?? q.last_price ?? q.close_price ?? 0,
            day_change: q.day_change ?? q.net_change ?? q.change ?? 0,
            day_change_pct: q.day_change_pct ?? q.percent_change ?? 0,
            instrument_token: instrKey,
            ...q,
          };
          setSnapshotQuote(normalized);
          setIsSnapshotMode(true);
          onSnapshotResolved?.(symbol, normalized); // bubble up to parent if needed
        } else {
          setSnapshotError(true);
          setIsSnapshotMode(true);
        }
      })
      .catch(() => {
        setSnapshotError(true);
        setIsSnapshotMode(true);
      })
      .finally(() => setSnapshotLoading(false));
  }, [symbol]); // Re-fires only when symbol changes

  const currentItems = wl.activeWatchlist?.items ?? [];
  const existingSymbols = currentItems.map((i) => i.symbol);

  // ── Effective quote: prefer live WS data, fall back to snapshot ───────────────
  const liveQuote = stocks[symbol];
  const quote = hasLivePrice(liveQuote) ? liveQuote : snapshotQuote;
  const ltp = !quote ? 0 : typeof quote === 'number' ? quote : (quote?.ltp ?? 0);
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
    if (isUpstoxConnected === null) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      );
    }

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
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-8">
        <button onClick={onClose} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ChevronRight className="rotate-180" size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight">{symbol}</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase">NSE • EQUITY</p>

          {/* Data-source badge */}
          {snapshotLoading && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-zinc-800 rounded-full text-[9px] font-bold text-zinc-400 uppercase tracking-wide">
              Fetching price…
            </span>
          )}
          {!snapshotLoading && isSnapshotMode && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 uppercase tracking-wide">
              <Camera size={8} /> Snapshot • No Live Stream
            </span>
          )}
          {!snapshotLoading && !isSnapshotMode && hasLivePrice(liveQuote) && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
              <Radio size={8} /> Live
            </span>
          )}
        </div>

        <button
          onClick={toggleWatchlist}
          className={cn('p-3 rounded-2xl transition-all',
            existingSymbols.includes(symbol) ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-zinc-400',
          )}
        >
          <Plus size={24} className={cn(existingSymbols.includes(symbol) && 'rotate-45')} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">

        {/* Price block */}
        <div className="text-center">
          {snapshotLoading ? (
            <div className="flex justify-center items-center h-16">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          ) : ltp > 0 ? (
            <>
              <p className="text-5xl font-bold tracking-tighter mb-2">{formatCurrency(ltp)}</p>
              <p className={cn('text-sm font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
                {isPositive && change !== 0 ? '+' : ''}{formatCurrency(Math.abs(change))} (
                {isPositive && changePct !== 0 ? '+' : ''}{changePct.toFixed(2)}%) Today
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl font-bold tracking-tighter mb-2 text-zinc-600">--</p>
              {snapshotError && (
                <p className="text-xs text-zinc-500 mt-1">
                  Price unavailable — instrument not in pre-subscribed list and snapshot failed.
                </p>
              )}
            </>
          )}
        </div>

        {/* Chart */}
        <div className="h-80 bg-zinc-900/50 rounded-4xl border border-zinc-800/50 relative overflow-hidden">
          {renderChart()}
        </div>

        {/* Technical Overview */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity size={18} />
            <h4 className="text-xs font-bold uppercase tracking-widest">Technical Overview</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'RSI (14)', value: '58.42', sub: 'Neutral', color: 'text-white' },
              { label: 'MACD', value: 'Bullish', sub: 'Crossover', color: 'text-emerald-500' },
              { label: '200 DMA', value: ltp > 0 ? (ltp * 0.92).toFixed(2) : '--', sub: '', color: 'text-white' },
              { label: '52W High', value: ltp > 0 ? (ltp * 1.15).toFixed(2) : '--', sub: '', color: 'text-white' },
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

        {/* Snapshot disclaimer */}
        {isSnapshotMode && !snapshotLoading && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 flex items-start gap-3">
            <Camera size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-amber-400">Snapshot Data Only</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                This instrument is not in the pre-subscribed live stream. Price is from a
                one-time snapshot and will{' '}
                <span className="text-amber-400 font-semibold">not auto-update</span>. Verify
                before placing an order.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Buy / Sell bar */}
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