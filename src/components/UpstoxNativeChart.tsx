import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, Time } from 'lightweight-charts';
import { AlertTriangle } from 'lucide-react';
// FIX: Changed to named import
import { apiClient } from '../api/client';

interface UpstoxNativeChartProps {
  symbol: string;
  instrumentToken: string; // Upstox specific token (e.g., NSE_EQ|INE002A01018)
}

const UpstoxNativeChart: React.FC<UpstoxNativeChartProps> = ({ symbol, instrumentToken }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize the Chart UI
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#A1A1AA', // zinc-400
      },
      grid: {
        vertLines: { color: '#27272A' }, // zinc-800
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

    // 2. Add Candlestick Series using the v5 syntax
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', // emerald-500
      downColor: '#EF4444', // red-500
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    
    seriesRef.current = candlestickSeries;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight 
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // 3. Fetch Data via the Backend Proxy
    const fetchUpstoxData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetching 'day' candles for the last 1 month from Upstox
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        
        const res = await apiClient.get('/api/market/history', {
          params: {
            instrument: instrumentToken,
            interval: 'day',
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
        });

        if (res.data?.status === 'success' && res.data?.candles) {
          // Map backend response to Lightweight Charts format
          const formattedData = res.data.candles.map((c: any) => ({
            // Cast the resulting number explicitly to the lightweight-charts Time type
            time: (new Date(c.timestamp).getTime() / 1000) as Time, 
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));

          // Sort chronologically as required by the library
          formattedData.sort((a: any, b: any) => (a.time as number) - (b.time as number));

          candlestickSeries.setData(formattedData);
          chart.timeScale().fitContent();
        } else {
          throw new Error("Invalid data format received");
        }
      } catch (err: any) {
        console.error("Failed to fetch Upstox chart data:", err);
        // Show specific backend error if available, else generic
        setError(err.response?.data?.error || "Check Upstox API connection");
      } finally {
        setLoading(false);
      }
    };

    if (instrumentToken) {
      fetchUpstoxData();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [instrumentToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-900/50 rounded-2xl border border-zinc-800">
        <AlertTriangle className="text-zinc-600 mb-3" size={28} />
        <p className="text-xs font-bold text-zinc-400">Data Fetch Failed</p>
        <p className="text-[10px] text-zinc-500 mt-1 max-w-50 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={chartContainerRef} className="absolute inset-0" />
      
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Upstox Data...</p>
        </div>
      )}
    </div>
  );
};

export default UpstoxNativeChart;