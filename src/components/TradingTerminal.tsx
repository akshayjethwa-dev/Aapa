import React, { useEffect, useRef, useState } from 'react';
import LiveChart, { LiveChartRef } from './LiveChart';
import { apiClient } from '../api/client';
import { Time } from 'lightweight-charts';

const TradingTerminal = ({ 
  instrumentKey, 
  timeframe = '1m', // Default to 1 minute
  onPriceUpdate 
}: { 
  instrumentKey: string;
  timeframe?: string;
  onPriceUpdate?: (price: number) => void;
}) => {
  const chartRef = useRef<LiveChartRef>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onPriceUpdateRef = useRef(onPriceUpdate);
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  // Maps UI timeframe to seconds for math aggregation
  const getBucketSeconds = (tf: string) => {
    switch(tf) {
      case '1m': return 60;
      case '5m': return 300;
      case '15m': return 900;
      case '1h': return 3600;
      case '1D': return 86400; // 1 day
      default: return 60;
    }
  };

  // Groups raw 1-minute candles into 5m, 15m, 1h blocks seamlessly
  const aggregateCandles = (candles: any[], bucketSeconds: number) => {
    if (bucketSeconds === 60 || bucketSeconds === 86400) return candles; 
    
    const aggregated: any[] = [];
    let currentCandle: any = null;

    for (const c of candles) {
        const alignedTime = c.time - (c.time % bucketSeconds);
        
        if (!currentCandle || currentCandle.time !== alignedTime) {
            if (currentCandle) aggregated.push(currentCandle);
            currentCandle = { time: alignedTime, open: c.open, high: c.high, low: c.low, close: c.close };
        } else {
            currentCandle.high = Math.max(currentCandle.high, c.high);
            currentCandle.low = Math.min(currentCandle.low, c.low);
            currentCandle.close = c.close;
        }
    }
    if (currentCandle) aggregated.push(currentCandle);
    return aggregated;
  };

  useEffect(() => {
    let ws: WebSocket;

    // Upstox requires 'day' for 1D, otherwise we fetch '1minute' and aggregate it manually
    const fetchInterval = timeframe === '1D' ? 'day' : '1minute';
    const bucketSeconds = getBucketSeconds(timeframe);

    const initializeChart = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch historical data
        const response = await apiClient.get(`/api/market/history?instrument=${instrumentKey}&interval=${fetchInterval}`);
        const candles = response.data?.data?.candles || response.data?.candles || response.data || [];
        
        if (Array.isArray(candles) && candles.length > 0) {
          const formattedData = candles.map((c: any) => ({
            time: (Math.floor(new Date(c.timestamp || c.time || c[0]).getTime() / 1000)) as Time, 
            open: Number(c.open || c[1]),
            high: Number(c.high || c[2]),
            low: Number(c.low || c[3]),
            close: Number(c.close || c[4])
          })).filter(d => !isNaN(d.time as number) && !isNaN(d.close));

          const uniqueData = formattedData
            .sort((a, b) => (a.time as number) - (b.time as number))
            .filter((v, i, a) => i === 0 || v.time !== a[i - 1].time);

          // Apply aggregation!
          const finalData = aggregateCandles(uniqueData, bucketSeconds);
          chartRef.current?.setHistoricalData(finalData);
        }
        setLoading(false);

        // 2. Connect to WebSocket
        const wsBase = (import.meta as any).env?.VITE_WS_URL?.trim() || 
          (typeof window !== 'undefined'
            ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
            : 'ws://localhost:3000');
            
        ws = new WebSocket(`${wsBase}/market-data`);
        
        ws.onmessage = async (event) => {
          try {
            const tickData = JSON.parse(event.data); 
            
            if (tickData.instrumentKey === instrumentKey && tickData.ltp) {
              const tickTimeMs = tickData.timestamp || tickData.exchange_timestamp || Date.now();
              const tickTimeSeconds = Math.floor(tickTimeMs / 1000);
              
              let alignedTime;
              if (timeframe === '1D') {
                 // IST is UTC+5:30 (19800 seconds). Aligns daily candles to Indian midnight.
                 const istSeconds = tickTimeSeconds + 19800;
                 alignedTime = (istSeconds - (istSeconds % 86400) - 19800) as Time;
              } else {
                 alignedTime = (tickTimeSeconds - (tickTimeSeconds % bucketSeconds)) as Time;
              }
              
              chartRef.current?.updateTick({
                time: alignedTime, 
                open: Number(tickData.open ?? tickData.ltp),
                high: Number(tickData.high ?? tickData.ltp),
                low: Number(tickData.low ?? tickData.ltp),
                close: Number(tickData.ltp)
              });

              if (onPriceUpdateRef.current) {
                onPriceUpdateRef.current(tickData.ltp);
              }
            }
          } catch(e) {}
        };

      } catch (err) {
        console.error("Error loading chart data:", err);
        setError("Failed to load market data");
        setLoading(false);
      }
    };

    initializeChart();

    return () => {
      if (ws) ws.close();
    };
  }, [instrumentKey, timeframe]); // FIX: Re-run effect when timeframe changes

  return (
    <div className="flex-1 w-full h-full relative min-h-100 flex flex-col">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
           <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
           <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Syncing {timeframe} Data...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl text-rose-500 text-xs font-bold">
             {error}
          </div>
        </div>
      )}
      
      <div className="absolute inset-0">
         <LiveChart ref={chartRef} symbol={instrumentKey} />
      </div>
    </div>
  );
};

export default TradingTerminal;