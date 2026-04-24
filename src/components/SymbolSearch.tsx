// src/components/SymbolSearch.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, ChevronRight, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
// We no longer import filterSymbols from symbols.ts

export type Instrument = {
  instrument_key: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
};

type SymbolSearchProps = {
  isOpen: boolean;
  onClose: () => void;
  stocks: Record<string, any>;
  onSelect: (symbol: any) => void;
};

const SymbolSearch: React.FC<SymbolSearchProps> = ({
  isOpen,
  onClose,
  stocks,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>(['RELIANCE', 'NIFTY 50', 'TCS']);

  // Reset query on close
  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  // Debounced API Search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // REPLACE WITH YOUR ACTUAL BACKEND API URL
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = await res.json();
        setResults(data.instruments || []);
      } catch (error) {
        console.error('Failed to fetch instruments:', error);
      } finally {
        setLoading(false);
      }
    }, 350); // 350ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (instrument: Instrument) => {
    // Map backend instrument format to your app's expected SymbolDefinition format
    const mappedSymbol = {
      id: instrument.instrument_key,
      name: instrument.tradingsymbol,
      code: instrument.tradingsymbol,
      type: instrument.instrument_type === 'EQ' ? 'EQUITY' : 'INDEX',
      segment: instrument.exchange as 'NSE' | 'BSE',
      upstoxInstrumentKey: instrument.instrument_key,
    };

    onSelect(mappedSymbol);
    setRecent((prev) => {
      const next = [instrument.tradingsymbol, ...prev.filter((n) => n !== instrument.tradingsymbol)];
      return next.slice(0, 6);
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      key="symbol-search-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-150 bg-black/95 backdrop-blur-xl p-6 flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-900 text-zinc-400"
        >
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <div className="flex-1 relative">
          <SearchIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
            size={18}
          />
          <input
            autoFocus
            type="text"
            placeholder="Search all NSE & BSE stocks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all text-white"
          />
          {loading && (
             <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" size={18} />
          )}
        </div>
      </div>

      {/* Results / recent */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {results.length > 0 ? (
          results.map((sym) => {
            // Check if we already have live data for this via WebSockets
            const quote = stocks[sym.tradingsymbol];
            const ltp = typeof quote === 'number' ? quote : quote?.ltp ?? 0;
            const changePct = typeof quote === 'number' ? 0 : quote?.day_change_pct ?? 0;
            const isPositive = changePct >= 0;

            return (
              <div
                key={sym.instrument_key}
                onClick={() => handleSelect(sym)}
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-xs text-zinc-500">
                    {sym.tradingsymbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-tight">
                      {sym.tradingsymbol}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">
                      {sym.exchange} • {sym.name.substring(0, 25)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    {ltp ? formatCurrency(ltp) : '--'}
                  </p>
                  <p className={cn('text-[10px] font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
                    {isPositive && changePct !== 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })
        ) : query.length >= 2 && !loading ? (
          <div className="text-center py-20">
            <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
              No results found
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Recent Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {recent.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SymbolSearch;