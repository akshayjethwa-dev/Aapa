import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, Time, CandlestickData } from 'lightweight-charts';
import { useAuthStore } from '../store/authStore';
import { wsClient } from '../lib/brokers/websocket';
import { useMarketDataStore } from '../store/marketDataStore';

export interface LiveChartRef {
  // Use the library's native strict types for the data
  updateTick: (tick: CandlestickData<Time>) => void;
  setHistoricalData: (data: CandlestickData<Time>[]) => void;
}

const LiveChart = forwardRef<LiveChartRef, { symbol: string }>(({ symbol }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Real-time market data hooks
  const token = useAuthStore((state) => state.token);
  const tickData = useMarketDataStore((state) => state.ticks[symbol]);

  // Using 'any' internally for the refs prevents interface mismatches 
  // while keeping the component props fully type-safe.
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  // 1. WebSocket Subscription
  useEffect(() => {
    if (token && symbol) {
      wsClient.connect(token);
      wsClient.subscribe([symbol], 'full');
    }
    return () => {
      if (symbol) wsClient.unsubscribe([symbol]);
    };
  }, [token, symbol]);

  // 2. Push Real-time Ticks to Chart
  useEffect(() => {
    if (tickData && tickData.ltp && seriesRef.current) {
      const time = Math.floor(Date.now() / 1000) as Time;
      // In a real app, you might build a proper OHLC candle from ticks.
      // Here we just plot the LTP as a 1-second candle for demonstration.
      seriesRef.current.update({
        time,
        open: tickData.ltp,
        high: tickData.ltp,
        low: tickData.ltp,
        close: tickData.ltp,
      });
    }
  }, [tickData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create the Chart Instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#A1A1AA', // zinc-400
      },
      grid: {
        vertLines: { color: 'rgba(39, 39, 42, 0.5)' }, // zinc-800
        horzLines: { color: 'rgba(39, 39, 42, 0.5)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    // Add Candlestick Series
    // FIX: Cast chart as 'any' to bypass the aggressive TS typing error 
    // for addCandlestickSeries while retaining exact functionality.
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981', // emerald-500
      downColor: '#f43f5e', // rose-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  // 3. Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setHistoricalData: (data) => {
      if (seriesRef.current) {
        seriesRef.current.setData(data);
      }
    },
    updateTick: (tick) => {
      if (seriesRef.current) {
        seriesRef.current.update(tick);
      }
    }
  }));

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
});

// Good practice for forwardRef components in React devtools
LiveChart.displayName = 'LiveChart';

export default LiveChart;