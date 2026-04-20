import React, { useEffect, useRef, useState } from 'react';
import LiveChart, { LiveChartRef } from './LiveChart';
import { apiClient } from '../api/client';
import { Time } from 'lightweight-charts';

const TradingTerminal = ({ 
  instrumentKey, 
  onPriceUpdate 
}: { 
  instrumentKey: string;
  onPriceUpdate?: (price: number) => void;
}) => {
  const chartRef = useRef<LiveChartRef>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;

    const initializeChart = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch historical data
        const response = await apiClient.get(`/api/market/history?instrument=${instrumentKey}`);
        
        if (response.data && response.data.candles) {
          const formattedData = response.data.candles.map((c: any) => ({
            // Explicitly cast the calculated number to the branded Time type
            time: (Math.floor(new Date(c.timestamp).getTime() / 1000)) as Time, 
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }));

          // Load initial data into the chart
          chartRef.current?.setHistoricalData(formattedData);
        }
        setLoading(false);

        // 2. Connect to WebSocket
        ws = new WebSocket(`${import.meta.env.VITE_WS_URL || 'ws://localhost:8080'}/market-data`);
        
        ws.onmessage = async (event) => {
          const tickData = JSON.parse(event.data); 
          
          if (tickData.instrumentKey === instrumentKey) {
            // Explicitly cast the current tick timestamp as Time
            chartRef.current?.updateTick({
              time: Math.floor(Date.now() / 1000) as Time, 
              open: tickData.open,
              high: Math.max(tickData.ltp, tickData.high),
              low: Math.min(tickData.ltp, tickData.low),
              close: tickData.ltp
            });

            if (onPriceUpdate) {
              onPriceUpdate(tickData.ltp);
            }
          }
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
  }, [instrumentKey, onPriceUpdate]); // Added onPriceUpdate to dependencies just to be React-strict

  return (
    // FIX: Added flex-1 and min-h-[400px] to ensure the canvas never collapses to 0-height
    <div className="flex-1 w-full h-full relative min-h-100 flex flex-col">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
           <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
           <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Syncing Data...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl text-rose-500 text-xs font-bold">
             {error}
          </div>
        </div>
      )}
      
      {/* Wrapper to ensure the chart binds strictly to the parent bounds */}
      <div className="absolute inset-0">
         <LiveChart ref={chartRef} symbol={instrumentKey} />
      </div>
    </div>
  );
};

export default TradingTerminal;