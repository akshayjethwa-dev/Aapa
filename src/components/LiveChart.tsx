import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';
import { UpstoxBrokerService } from '../lib/brokers/upstox';
import { useMarketDataStore } from '../store/marketDataStore'; 

interface LiveChartProps {
  instrumentKey: string;
  height?: number | string;
  theme?: 'dark' | 'light';
}

const LiveChart: React.FC<LiveChartProps> = ({ instrumentKey, height = 400, theme = 'dark' }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  // Track the current forming candle locally
  const currentCandleRef = useRef<any>(null);

  // Subscribe to live tick data from your WebSocket store
  const latestTick = useMarketDataStore(state => state.ticks[instrumentKey]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize Lightweight Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        // Use ColorType enum to fix TS error for 'solid'
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#18181b' : '#ffffff' }, 
        textColor: theme === 'dark' ? '#a1a1aa' : '#3f3f46',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#27272a' : '#e4e4e7' }, 
        horzLines: { color: theme === 'dark' ? '#27272a' : '#e4e4e7' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0, // Normal mode
      }
    });

    // Cast chart as any to bypass strict addCandlestickSeries TS missing method errors in some versions
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981', 
      downColor: '#ef4444', 
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // 2. Fetch and set historical data
    const initData = async () => {
      // Ensure we get the token (adjust this if you manage it differently)
      const token = localStorage.getItem('upstox_access_token');
      if (!token) return;

      const brokerService = new UpstoxBrokerService();
      // Using the method we added to the Upstox class previously
      const history = await brokerService.getIntradayCandles(token, instrumentKey, '1minute');
      
      if (history.length > 0) {
        candlestickSeries.setData(history);
        // Save the last candle as our starting point for live updates
        currentCandleRef.current = history[history.length - 1];
        chart.timeScale().fitContent();
      }
    };

    initData();

    // 3. Cleanup ResizeObserver and Chart instance on unmount
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [instrumentKey, theme]);

  // 4. Update chart when a new WebSocket tick arrives
  useEffect(() => {
    if (!seriesRef.current || !latestTick || !currentCandleRef.current) return;

    // Safely extract timestamp (fallback to exchange_timestamp or Date.now if missing in type)
    const tickTime = (latestTick as any).timestamp || (latestTick as any).exchange_timestamp || Date.now();
    const tickTimeSeconds = Math.floor(tickTime / 1000);
    
    // Round down to the nearest minute to find the candle's opening time
    const minuteTime = (tickTimeSeconds - (tickTimeSeconds % 60)) as any; 
    
    // Fallback ltp to prev close if undefined to fix TS error
    const ltp = latestTick.ltp ?? currentCandleRef.current.close;

    let updatedCandle;

    // Check if we are forming a new minute candle or updating the current one
    if (minuteTime > currentCandleRef.current.time) {
      // Create a brand new candle
      updatedCandle = {
        time: minuteTime,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
      };
    } else {
      // Update existing candle
      const prev = currentCandleRef.current;
      updatedCandle = {
        time: prev.time,
        open: prev.open,
        high: Math.max(prev.high, ltp),
        low: Math.min(prev.low, ltp),
        close: ltp, 
      };
    }

    // Push the update to the chart and update our local ref
    (seriesRef.current as any).update(updatedCandle);
    currentCandleRef.current = updatedCandle;

  }, [latestTick]);

  return <div ref={chartContainerRef} style={{ width: '100%', height }} />;
};

export default LiveChart;