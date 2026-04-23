import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Filter,
  Settings2,
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import OptionChain from '../components/OptionChain';
import OrderWindow, { OrderConfig } from './OrderWindow';
import { INDEX_CONSTITUENTS, F_O_INDICES } from '../constants/marketData';
import FullChartModal from '../components/FullChartModal';

const IndexDetail = ({
  indexName,
  stocks,
  onClose,
  onPlaceOrder,
}: {
  indexName: string;
  stocks: Record<string, any>;
  onClose: () => void;
  onPlaceOrder: (config: any) => void;
}) => {
  const [activeChart, setActiveChart] = useState<any>(null);
  const [orderConfig, setOrderConfig] = useState<OrderConfig | null>(null);

  const isFO = F_O_INDICES.includes(indexName) || indexName === 'SENSEX';
  const constituents = INDEX_CONSTITUENTS[indexName] || [];

  const quote = stocks[indexName];
  const spotPrice = typeof quote === 'number' ? quote : quote?.ltp || 0;
  const high = spotPrice * 1.005;
  const low = spotPrice * 0.992;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-70 bg-zinc-950 flex flex-col text-zinc-100"
    >
      {/* ── Header ── */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 sticky top-0 z-60">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[13px] font-bold tracking-tight text-white">{indexName}</h2>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
              {isFO ? 'Option Chain' : 'Index Detail'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setActiveChart({ symbol: indexName, ltp: spotPrice })}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <BarChart3 size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors">
            <Filter size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Full Chart Modal ── */}
      <AnimatePresence mode="wait">
        {activeChart && (
          <FullChartModal
            key="full-chart-modal"
            instrument={activeChart}
            onClose={() => setActiveChart(null)}
          />
        )}
        {orderConfig && (
          <OrderWindow
            config={orderConfig}
            onClose={() => setOrderConfig(null)}
            onOrderPlaced={() => setOrderConfig(null)}
          />
        )}
      </AnimatePresence>

      {/* ── High / Low strip ── */}
      <div className="px-4 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
            Day High
          </span>
          <span className="text-[10px] font-bold text-emerald-500">
            {high.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
            Day Low
          </span>
          <span className="text-[10px] font-bold text-rose-500">
            {low.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        {isFO ? (
          /* FO: delegate entirely to OptionChain (fullChain + lockSymbol) */
          <div className="px-4 pt-4 pb-6">
            <OptionChain
  fullChain
  lockSymbol
  initialSymbol={indexName}
  stocks={stocks}
  onPlaceOrder={(config) => {
    // Open OrderWindow locally for inline quick-trade from IndexDetail
    setOrderConfig(config as import('./OrderWindow').OrderConfig);
  }}
/>
          </div>
        ) : (
          /* Non-FO: show index constituents */
          <div className="space-y-5 pt-3 px-5 pb-6">
            <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
              Constituents
            </h3>
            {constituents.map((symbol: string) => {
              const cQuote = stocks[symbol];
              const cLtp = typeof cQuote === 'number' ? cQuote : cQuote?.ltp || 2500;
              const cChangePct = cQuote?.day_change_pct || 0;
              const isPositive = cChangePct >= 0;

              return (
                <div
                  key={symbol}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-[11px] text-zinc-400">
                      {symbol.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white tracking-tight">
                        {symbol}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">NSE</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-white">
                      {formatCurrency(cLtp)}
                    </p>
                    <p
                      className={cn(
                        'text-[9px] font-bold',
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {cChangePct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default IndexDetail;