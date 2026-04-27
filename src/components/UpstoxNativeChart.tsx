import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, Time } from 'lightweight-charts';
import { AlertTriangle } from 'lucide-react';
import { UpstoxBrokerService } from '../lib/brokers/upstox'; 

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
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;

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

    const fetchUpstoxData = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        
        const upstoxService = new UpstoxBrokerService();
        
        // Fix: Explicitly cast 'rawData' as 'any' so TypeScript allows property access
        const rawData: any = await upstoxService.getHistoricalCandles(
          instrumentToken, 
          'day', 
          fromDate.toISOString().split('T')[0], 
          toDate.toISOString().split('T')[0],
          { signal: abortController.signal } 
        );

        if (abortController.signal.aborted) return;

        // Safely extract the data array whether it's wrapped in { data: { candles: [] } } or direct
        const candlesArray = Array.isArray(rawData) ? rawData : 
                             (rawData?.data?.candles || rawData?.candles || rawData?.data || []);

        if (!Array.isArray(candlesArray) || candlesArray.length === 0) {
          throw new Error("No data returned from Upstox");
        }

        const formattedData = candlesArray.map((candle: any) => ({
          time: (Math.floor(new Date(candle[0] || candle.timestamp || candle.time).getTime() / 1000)) as Time,
          open: Number(candle[1] ?? candle.open),
          high: Number(candle[2] ?? candle.high),
          low: Number(candle[3] ?? candle.low),
          close: Number(candle[4] ?? candle.close),
        })).filter(d => !isNaN(d.time as number) && !isNaN(d.close)); // Drop invalid rows

        // Sort chronologically and deduplicate (Lightweight Charts crashes on duplicates)
        const uniqueData = formattedData
          .sort((a, b) => (a.time as number) - (b.time as number))
          .filter((v: any, i: number, a: any[]) => i === 0 || v.time !== a[i - 1].time);

        if (uniqueData.length > 0) {
          candlestickSeries.setData(uniqueData);
          chart.timeScale().fitContent();
        } else {
          setError(true);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Failed to fetch Upstox chart data:", err);
          setError(true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (instrumentToken) fetchUpstoxData();

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
        <p className="text-[10px] text-zinc-500 mt-1">Check Upstox API connection</p>
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