// src/components/TradingTerminal.tsx
import React, { useRef, useState } from 'react';
import LiveChart, { LiveChartRef } from './LiveChart';
import { useLiveChart } from '../hooks/useLiveChart';
import { cn } from '../lib/utils';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '1D';
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '1D'];

const TradingTerminal = ({
  instrumentKey,
  timeframe: externalTimeframe,
  onPriceUpdate,
}: {
  instrumentKey: string;
  timeframe?: Timeframe;
  onPriceUpdate?: (price: number) => void;
}) => {
  const chartRef = useRef<LiveChartRef>(null);
  const [internalTf, setInternalTf] = useState<Timeframe>(externalTimeframe ?? '1m');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const activeTimeframe = externalTimeframe ?? internalTf;

  useLiveChart({
    instrumentKey,
    timeframe: activeTimeframe,
    chartRef,
    tickRateLimit: 2,       // ← 2 updates/sec max — safe for mid-range Android
    onPriceUpdate,
    onLoadingChange: setLoading,
    onError: setError,
  });

  return (
    <div className="flex-1 w-full h-full relative min-h-50 flex flex-col">
      {/* Timeframe Tabs */}
      {!externalTimeframe && (
        <div className="flex gap-1 px-2 pt-2 pb-1 z-10 relative">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setInternalTf(tf)}
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all',
                activeTimeframe === tf
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
            Syncing {activeTimeframe} Data…
          </p>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl text-rose-500 text-xs font-bold">
            {error}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="absolute inset-0">
        <LiveChart ref={chartRef} symbol={instrumentKey} />
      </div>
    </div>
  );
};

export default TradingTerminal;