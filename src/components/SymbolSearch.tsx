// src/components/SymbolSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, ChevronRight, Loader2, X } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export type Instrument = {
  instrument_key: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
};

type ExchangeFilter = 'ALL' | 'NSE' | 'BSE';

type SymbolSearchProps = {
  isOpen: boolean;
  onClose: () => void;
  stocks: Record<string, any>;
  onSelect: (symbol: any) => void;
};

// ✅ FIXED: Complete type mapping (was: ternary that mapped everything non-EQ → 'INDEX')
function mapInstrumentType(raw: string): string {
  switch (raw?.toUpperCase()) {
    case 'EQ':               return 'EQUITY';
    case 'INDEX':
    case 'UNDIND':           return 'INDEX';
    case 'FUT': case 'FUTIDX': return 'FUTURES';
    case 'OPT': case 'OPTIDX': return 'OPTIONS';
    default:                 return raw ?? 'EQUITY';
  }
}

function typeBadgeClass(type: string): string {
  switch (type.toUpperCase()) {
    case 'EQ':               return 'bg-emerald-500/10 text-emerald-400';
    case 'INDEX': case 'UNDIND': return 'bg-sky-500/10 text-sky-400';
    case 'FUT': case 'FUTIDX':  return 'bg-amber-500/10 text-amber-400';
    case 'OPT': case 'OPTIDX':  return 'bg-purple-500/10 text-purple-400';
    default:                 return 'bg-zinc-500/10 text-zinc-400';
  }
}

const SymbolSearch: React.FC<SymbolSearchProps> = ({ isOpen, onClose, stocks, onSelect }) => {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<Instrument[]>([]);
  const [loading, setLoading]         = useState(false);
  const [exchangeFilter, setExchange] = useState<ExchangeFilter>('ALL');
  const [recent, setRecent]           = useState<string[]>(['RELIANCE', 'NIFTY 50', 'TCS', 'INFY']);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); setExchange('ALL'); }
  }, [isOpen]);

  const search = useCallback(async (q: string, exchange: ExchangeFilter) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: trimmed });
      if (exchange !== 'ALL') params.set('exchange', exchange);
      const res  = await fetch(`/api/instruments/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.instruments ?? []);
    } catch (err) {
      console.error('[SymbolSearch] fetch error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => search(query, exchangeFilter), 350);
    return () => clearTimeout(id);
  }, [query, exchangeFilter, search]);

  const handleSelect = (instrument: Instrument) => {
    onSelect({
      id:                  instrument.instrument_key,
      name:                instrument.tradingsymbol,
      code:                instrument.tradingsymbol,
      type:                mapInstrumentType(instrument.instrument_type),
      segment:             instrument.exchange as 'NSE' | 'BSE',
      upstoxInstrumentKey: instrument.instrument_key,
    });
    setRecent((prev) =>
      [instrument.tradingsymbol, ...prev.filter((n) => n !== instrument.tradingsymbol)].slice(0, 6)
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="symbol-search-overlay"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl p-4 sm:p-6 flex flex-col"
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} aria-label="Close search"
            className="p-2 -ml-1 rounded-full hover:bg-zinc-900 text-zinc-400 transition-colors">
            <ChevronRight className="rotate-180" size={22} />
          </button>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={17} />
            <input autoFocus type="search"
              placeholder="Search NSE & BSE stocks, indices…"
              value={query} onChange={(e) => setQuery(e.target.value)}
              className={
                'w-full bg-zinc-900 border rounded-2xl py-3.5 pl-11 pr-11 text-sm font-semibold ' +
                'focus:border-emerald-500/50 outline-none transition-all text-white ' +
                (loading ? 'border-emerald-800/60' : 'border-zinc-800')
              }
            />
            {loading ? (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" size={17} />
            ) : query.length > 0 ? (
              <button onClick={() => setQuery('')} aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors">
                <X size={17} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Exchange filter chips */}
        <div className="flex gap-2 mb-5">
          {(['ALL', 'NSE', 'BSE'] as ExchangeFilter[]).map((ex) => (
            <button key={ex} onClick={() => setExchange(ex)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors',
                exchangeFilter === ex
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300',
              )}>
              {ex}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-2 pb-6">
          {results.length > 0 ? results.map((sym) => {
            const quote = stocks[sym.tradingsymbol];
            const ltp = typeof quote === 'number' ? quote : (quote?.ltp ?? 0);
            const changePct = typeof quote === 'number' ? 0 : (quote?.day_change_pct ?? 0);
            const isPositive = changePct >= 0;
            return (
              <div key={sym.instrument_key} role="button" tabIndex={0}
                onClick={() => handleSelect(sym)}
                onKeyDown={(e) => e.key === 'Enter' && handleSelect(sym)}
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900 hover:border-zinc-700/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-400">
                    {sym.tradingsymbol.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white tracking-tight">{sym.tradingsymbol}</p>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', typeBadgeClass(sym.instrument_type))}>
                        {sym.instrument_type}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
                      {sym.exchange} • {sym.name.substring(0, 30)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold text-white">{ltp ? formatCurrency(ltp) : '--'}</p>
                  <p className={cn('text-[10px] font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
                    {isPositive && changePct !== 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          }) : query.length >= 2 && !loading ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <SearchIcon size={32} className="text-zinc-700" />
              <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">No results for "{query}"</p>
              <p className="text-xs text-zinc-700">Try a different exchange filter or check the spelling.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Recent Searches</h3>
              <div className="flex flex-wrap gap-2">
                {recent.map((s) => (
                  <button key={s} onClick={() => setQuery(s)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SymbolSearch;