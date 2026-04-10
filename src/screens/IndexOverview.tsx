import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, ChevronRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import { INDEX_CONSTITUENTS } from '../constants/marketData';

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
      className="fixed inset-0 z-80 bg-white flex flex-col text-zinc-900"
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

export default IndexOverview;