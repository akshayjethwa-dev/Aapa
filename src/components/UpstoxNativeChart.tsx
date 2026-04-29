// src/components/UpstoxNativeChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, Time } from 'lightweight-charts';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { apiClient } from '../api/client';

// ── Error types so StockDetail can render different copy ───────────────────────
export type ChartErrorType = 'no_broker' | 'invalid_token' | 'api_error' | 'no_data' | 'unknown';

export interface ChartError {
  type: ChartErrorType;
  message: string;
}

interface UpstoxNativeChartProps {
  symbol: string;
  instrumentToken: string;
  /** Called when the chart fails to load so parent can show tailored UI */
  onError?: (err: ChartError) => void;
}

// ── Map HTTP / API status to a typed error ─────────────────────────────────────
const classifyError = (status?: number, message?: string): ChartError => {
  const msg = (message || '').toLowerCase();

  if (msg.includes('connect your upstox') || msg.includes('please connect')) {
    return { type: 'no_broker', message: 'Connect Upstox to view live chart.' };
  }
  if (msg.includes('token') || msg.includes('expired') || msg.includes('unauthorized') || status === 401) {
    return { type: 'invalid_token', message: 'Your Upstox session has expired. Please reconnect.' };
  }
  if (status === 400) {
    return { type: 'api_error', message: message || 'Invalid instrument. Cannot load chart.' };
  }
  if (status && status >= 500) {
    return { type: 'api_error', message: 'Broker API is currently unavailable. Try again shortly.' };
  }
  if (status && status >= 400) {
    return { type: 'api_error', message: message || `Chart data could not be fetched (HTTP ${status}).` };
  }
  if (msg.includes('no data') || msg.includes('empty')) {
    return { type: 'no_data', message: 'No historical data available for this symbol.' };
  }
  return { type: 'unknown', message: message || 'Failed to load chart data.' };
};

const UpstoxNativeChart: React.FC<UpstoxNativeChartProps> = ({ symbol, instrumentToken, onError }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [chartError, setChartError] = useState<ChartError | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#A1A1AA',
      },
      grid: { vertLines: { color: '#27272A' }, horzLines: { color: '#27272A' } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', downColor: '#EF4444',
      borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    const abortController = new AbortController();

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setChartError(null);

        const response = await apiClient.get(
          `/api/market/history?instrument=${instrumentToken}&interval=day`,
          { signal: abortController.signal }
        );

        if (abortController.signal.aborted) return;

        // Backend always returns { status, candles } or { status, error }
        if (response.data?.status === 'error') {
          const err = classifyError(undefined, response.data.error);
          setChartError(err);
          onError?.(err);
          return;
        }

        const candles = response.data?.candles || response.data?.data?.candles || [];

        if (!Array.isArray(candles) || candles.length === 0) {
          const err: ChartError = { type: 'no_data', message: 'No historical data available for this symbol.' };
          setChartError(err);
          onError?.(err);
          return;
        }

        const formattedData = candles
          .map((candle: any) => ({
            time: Math.floor(new Date(candle.timestamp || candle[0] || candle.time).getTime() / 1000) as Time,
            open: Number(candle.open ?? candle[1]),
            high: Number(candle.high ?? candle[2]),
            low: Number(candle.low ?? candle[3]),
            close: Number(candle.close ?? candle[4]),
          }))
          .filter((d: any) => !isNaN(d.time as number) && !isNaN(d.close));

        const uniqueData = formattedData
          .sort((a: any, b: any) => (a.time as number) - (b.time as number))
          .filter((v: any, i: number, a: any[]) => i === 0 || v.time !== a[i - 1].time);

        if (uniqueData.length > 0) {
          candlestickSeries.setData(uniqueData);
          chart.timeScale().fitContent();
        } else {
          const err: ChartError = { type: 'no_data', message: 'No valid candle data found for this symbol.' };
          setChartError(err);
          onError?.(err);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        const httpStatus: number | undefined = err.response?.status;
        const apiMessage: string | undefined = err.response?.data?.error || err.response?.data?.message || err.message;
        const classified = classifyError(httpStatus, apiMessage);
        setChartError(classified);
        onError?.(classified);
        console.error('[UpstoxNativeChart] Data fetch failed:', classified);
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    if (instrumentToken) fetchChartData();

    return () => {
      abortController.abort();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [instrumentToken]);

  if (chartError) {
    const isNoBroker = chartError.type === 'no_broker' || chartError.type === 'invalid_token';
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-900/50 rounded-2xl border border-zinc-800 px-4 text-center gap-3">
        {isNoBroker ? <WifiOff className="text-zinc-500" size={28} /> : <AlertTriangle className="text-zinc-500" size={28} />}
        <p className="text-xs font-bold text-zinc-300">{chartError.message}</p>
        {chartError.type === 'no_data' && (
          <p className="text-[10px] text-zinc-500">Historical data may not be available for this instrument on Upstox.</p>
        )}
        {(chartError.type === 'api_error' || chartError.type === 'unknown') && (
          <p className="text-[10px] text-zinc-500">Check your Upstox connection or try again later.</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={chartContainerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Chart…</p>
        </div>
      )}
    </div>
  );
};

export default UpstoxNativeChart;