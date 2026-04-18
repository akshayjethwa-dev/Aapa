import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { AlertTriangle } from 'lucide-react';
// Assuming you have a function to call Upstox API
import { getHistoricalCandles } from '../lib/brokers/upstox'; 

interface UpstoxNativeChartProps {
  symbol: string;
  instrumentToken: string; // Upstox specific token (e.g., NSE_EQ|INE002A01018)
}

const UpstoxNativeChart: React.FC<UpstoxNativeChartProps> = ({ symbol, instrumentToken }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
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

    // 2. Add Candlestick Series
    const candlestickSeries = chart.addCandlestickSeries({
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

    // 3. Fetch Upstox Data
    const fetchUpstoxData = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // Example: Fetching 'day' candles for the last 1 month from Upstox
        // You will need to implement getHistoricalCandles in your upstox.ts file
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        
        // This expects your Upstox API wrapper to return data formatted for the chart
        const rawData = await getHistoricalCandles(
          instrumentToken, 
          'day', 
          fromDate.toISOString().split('T')[0], 
          toDate.toISOString().split('T')[0]
        );

        // Map Upstox response to Lightweight Charts format
        const formattedData = rawData.map((candle: any) => ({
          time: new Date(candle[0]).getTime() / 1000, // Unix timestamp in seconds
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
        }));

        // Sort chronologically as required by the library
        formattedData.sort((a, b) => a.time - b.time);

        candlestickSeries.setData(formattedData);
        chart.timeScale().fitContent();
      } catch (err) {
        console.error("Failed to fetch Upstox chart data:", err);
        setError(true);
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