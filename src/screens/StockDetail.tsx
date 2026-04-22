// src/screens/StockDetail.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Activity, Plus } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import UpstoxNativeChart from '../components/UpstoxNativeChart';
import ErrorBoundary from '../components/ErrorBoundary';
import { useWatchlists } from '../components/WatchlistManager';

type Props = {
  symbol: string;
  stocks: Record<string, any>;
  onClose: () => void;
  onPlaceOrder: (config: any) => void;
};

const getUpstoxInstrumentKey = (
  symbol: string,
  quote: any
): string => {
  if (symbol.includes('|')) return symbol;
  if (quote && typeof quote !== 'number' && quote.instrument_token) {
    return quote.instrument_token;
  }
  // StockDetail is for equities, default to NSE_EQ
  return `NSE_EQ|${symbol}`;
};

const StockDetail: React.FC<Props> = ({
  symbol,
  stocks,
  onClose,
  onPlaceOrder,
}) => {
  const wl = useWatchlists();
  const currentItems = wl.activeWatchlist?.items ?? [];
  const existingSymbols = currentItems.map((i) => i.symbol);

  const quote = stocks[symbol];
  const ltp =
    typeof quote === 'number'
      ? quote
      : quote?.ltp ?? 0;
  const change =
    typeof quote === 'number'
      ? 0
      : quote?.day_change ?? 0;
  const changePct =
    typeof quote === 'number'
      ? 0
      : quote?.day_change_pct ?? 0;
  const isPositive = change >= 0;

  const instrumentKey = getUpstoxInstrumentKey(symbol, quote);

  const toggleWatchlist = async () => {
    if (!wl.activeId) return;
    const alreadyIn = existingSymbols.includes(symbol);
    if (alreadyIn) {
      const item = currentItems.find((i) => i.symbol === symbol);
      if (item) {
        await wl.removeSymbol(wl.activeId, item.id);
      }
    } else {
      await wl.addSymbol(wl.activeId, symbol);
    }
  };

  return (
    <motion.div
      key="stock-detail"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-60 bg-black p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={onClose}
          className="p-3 rounded-2xl bg-zinc-900 text-zinc-400"
        >
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight">
            {symbol}
          </h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase">
            NSE • EQUITY
          </p>
        </div>
        <button
          onClick={toggleWatchlist}
          className={cn(
            'p-3 rounded-2xl transition-all',
            existingSymbols.includes(symbol)
              ? 'bg-emerald-500 text-black'
              : 'bg-zinc-900 text-zinc-400'
          )}
        >
          <Plus
            size={24}
            className={cn(
              existingSymbols.includes(symbol) && 'rotate-45'
            )}
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-8 overflow-y-auto pb-24 scrollbar-hide">
        {/* Price + change */}
        <div className="text-center">
          <p className="text-5xl font-bold tracking-tighter mb-2">
            {formatCurrency(ltp)}
          </p>
          <p
            className={cn(
              'text-sm font-bold',
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            )}
          >
            {isPositive && change !== 0 ? '+' : ''}
            {formatCurrency(Math.abs(change))} (
            {isPositive && changePct !== 0 ? '+' : ''}
            {changePct.toFixed(2)}%) Today
          </p>
        </div>

        {/* Chart */}
        <div className="h-80 bg-zinc-900/50 rounded-4xl border border-zinc-800/50 relative overflow-hidden">
          <ErrorBoundary>
            <UpstoxNativeChart
              symbol={symbol}
              instrumentToken={instrumentKey}
            />
          </ErrorBoundary>
        </div>

        {/* Simple technical summary (static for now) */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity size={18} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Technical Overview
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                RSI (14)
              </p>
              <p className="text-sm font-bold text-white">
                58.42
                <span className="text-[10px] text-zinc-500 font-medium ml-1">
                  Neutral
                </span>
              </p>
            </div>
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                MACD
              </p>
              <p className="text-sm font-bold text-emerald-500">
                Bullish
                <span className="text-[10px] text-zinc-500 font-medium ml-1">
                  Crossover
                </span>
              </p>
            </div>
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                200 DMA
              </p>
              <p className="text-sm font-bold text-white">
                {(ltp * 0.92).toFixed(2)}
              </p>
            </div>
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                52W High
              </p>
              <p className="text-sm font-bold text-white">
                {(ltp * 1.15).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4">
        <button
          onClick={() =>
            onPlaceOrder({ side: 'SELL', symbol, price: ltp })
          }
          className="flex-1 bg-rose-500 hover:bg-rose-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/10"
        >
          SELL
        </button>
        <button
          onClick={() =>
            onPlaceOrder({ side: 'BUY', symbol, price: ltp })
          }
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/10"
        >
          BUY
        </button>
      </div>
    </motion.div>
  );
};

export default StockDetail;