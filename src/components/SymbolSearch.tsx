// src/components/SymbolSearch.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, ChevronRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import {
  SymbolDefinition,
  filterSymbols,
} from '../constants/symbols';

type SymbolSearchProps = {
  isOpen: boolean;
  onClose: () => void;
  stocks: Record<string, any>;
  onSelect: (symbol: SymbolDefinition) => void;
};

const SymbolSearch: React.FC<SymbolSearchProps> = ({
  isOpen,
  onClose,
  stocks,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([
    'RELIANCE',
    'NIFTY 50',
    'TCS',
    'ZOMATO',
  ]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const results = useMemo(
    () => (query ? filterSymbols(query) : []),
    [query]
  );

  const handleSelect = (symbol: SymbolDefinition) => {
    onSelect(symbol);
    setRecent((prev) => {
      const next = [symbol.name, ...prev.filter((n) => n !== symbol.name)];
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
            placeholder="Search indices, stocks, F&O..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all"
          />
        </div>
      </div>

      {/* Results / recent */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {results.length > 0 ? (
          results.map((sym) => {
            const quote = stocks[sym.name];
            const ltp =
              typeof quote === 'number'
                ? quote
                : quote?.ltp ?? 0;
            const changePct =
              typeof quote === 'number'
                ? 0
                : quote?.day_change_pct ?? 0;
            const isPositive = changePct >= 0;

            return (
              <div
                key={sym.id}
                onClick={() => handleSelect(sym)}
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-xs text-zinc-500">
                    {sym.name.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-tight">
                      {sym.name}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">
                      {sym.segment} •{' '}
                      {sym.type === 'INDEX' ? 'Index' : 'Equity'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    {ltp
                      ? formatCurrency(ltp)
                      : '--'}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] font-bold',
                      isPositive
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {isPositive && changePct !== 0 ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })
        ) : query ? (
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