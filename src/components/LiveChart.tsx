import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, IChartApi, ColorType, CandlestickSeries } from 'lightweight-charts';

export interface LiveChartRef {
  setHistoricalData: (data: any[]) => void;
  updateTick: (tick: any) => void;
}

interface LiveChartProps {
  symbol: string;
  height?: number | string;
  theme?: 'dark' | 'light';
}

const LiveChart = forwardRef<LiveChartRef, LiveChartProps>(({ symbol, height = '100%', theme = 'dark' }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null); 
  const currentCandleRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    setHistoricalData: (data: any[]) => {
      try {
        if (seriesRef.current && data.length > 0) {
          seriesRef.current.setData(data);
          currentCandleRef.current = data[data.length - 1];
          chartRef.current?.timeScale().fitContent();
        }
      } catch (e) {
        console.error("Failed to set historical data:", e);
      }
    },
    updateTick: (tick: any) => {
      if (!seriesRef.current || !tick || isNaN(tick.close)) return;
      
      let updatedCandle;
      if (!currentCandleRef.current || tick.time > currentCandleRef.current.time) {
        updatedCandle = { ...tick };
      } else {
        const prev = currentCandleRef.current;
        updatedCandle = {
          time: prev.time,
          open: prev.open,
          high: Math.max(prev.high, tick.high ?? tick.close),
          low: Math.min(prev.low, tick.low ?? tick.close),
          close: tick.close,
        };
      }

      try {
        seriesRef.current.update(updatedCandle);
        currentCandleRef.current = updatedCandle;
      } catch (e) {
        console.warn("Skipping bad tick data:", e);
      }
    }
  }));

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
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
      crosshair: { mode: 0 }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', 
      downColor: '#ef4444', 
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth, 
          height: chartContainerRef.current.clientHeight 
        });
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [theme]);

  return <div ref={chartContainerRef} style={{ width: '100%', height }} />;
});

LiveChart.displayName = 'LiveChart';
export default LiveChart;