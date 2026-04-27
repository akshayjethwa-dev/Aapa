import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, Time } from 'lightweight-charts';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';

interface UpstoxNativeChartProps {
  symbol: string;
  instrumentToken: string; 
}

const UpstoxNativeChart: React.FC<UpstoxNativeChartProps> = ({ symbol, instrumentToken }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize the Chart UI
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#A1A1AA', 
      },
      grid: {
        vertLines: { color: '#27272A' }, 
        horzLines: { color: '#27272A' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 2. Add Candlestick Series 
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', 
      downColor: '#EF4444', 
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight 
        });
      }
    };
    window.addEventListener('resize', handleResize);

    const abortController = new AbortController();

    // 3. Fetch Data via Backend API (avoids direct Upstox 400 errors and handles auth securely)
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // Fetch 1 month of daily data from your backend proxy
        const response = await apiClient.get(
            `/api/market/history?instrument=${instrumentToken}&interval=day`, 
            { signal: abortController.signal }
        );

        if (abortController.signal.aborted) return;

        const candles = response.data?.candles || response.data?.data?.candles || [];
        
        if (!Array.isArray(candles) || candles.length === 0) {
            throw new Error("No data returned");
        }

        const formattedData = candles.map((candle: any) => ({
          time: (Math.floor(new Date(candle.timestamp || candle[0] || candle.time).getTime() / 1000)) as Time,
          open: Number(candle.open || candle[1]),
          high: Number(candle.high || candle[2]),
          low: Number(candle.low || candle[3]),
          close: Number(candle.close || candle[4]),
        })).filter((d: any) => !isNaN(d.time as number) && !isNaN(d.close));

        // Sort chronologically and deduplicate (Lightweight Charts crashes on duplicates)
        const uniqueData = formattedData
          .sort((a: any, b: any) => (a.time as number) - (b.time as number))
          .filter((v: any, i: number, a: any[]) => i === 0 || v.time !== a[i - 1].time);

        if (uniqueData.length > 0) {
          candlestickSeries.setData(uniqueData);
          chart.timeScale().fitContent();
        } else {
          setError(true);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error("Failed to fetch chart data:", err);
          setError(true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (instrumentToken) {
      fetchChartData();
    }

    return () => {
      abortController.abort(); 
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [instrumentToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-900/50 rounded-2xl border border-zinc-800">
        <AlertTriangle className="text-zinc-600 mb-3" size={28} />
        <p className="text-xs font-bold text-zinc-400">Data Fetch Failed</p>
        <p className="text-[10px] text-zinc-500 mt-1">Check API connection</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={chartContainerRef} className="absolute inset-0" />
      
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Data...</p>
        </div>
      )}
    </div>
  );
};

export default UpstoxNativeChart;