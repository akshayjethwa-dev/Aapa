import React, { useState, useEffect, useRef, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTradingViewSymbol } from '../constants/marketData';

const TradingViewWidget = React.memo(({ symbol, height = "100%" }: { symbol: string, height?: string | number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Generate a unique ID for the TV container so React doesn't reuse ghost DOM nodes
  const widgetId = `tv-widget-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (!containerRef.current || !symbol) return;
    
    setLoading(true);
    setError(false);
    
    const currentContainer = containerRef.current;
    // 1. Aggressive cleanup of previous widget artifacts
    currentContainer.innerHTML = '';
    
    // 2. Create exact DOM structure TV expects with a unique ID
    const widgetContainer = document.createElement('div');
    widgetContainer.id = widgetId;
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    currentContainer.appendChild(widgetContainer);
    
    const tvSymbol = getTradingViewSymbol(symbol);

    // 3. Script injection
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    script.onerror = () => {
      console.error(`[TradingView] Failed to load script for symbol: ${symbol}`);
      setError(true);
      setLoading(false);
    };

    const config = {
      autosize: true,
      symbol: tvSymbol,
      interval: "5",
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "in",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: true,
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650"
    };
    
    script.innerHTML = JSON.stringify(config);
    currentContainer.appendChild(script);

    // Fade out loader to allow iframe paint
    const overlayTimeoutId = setTimeout(() => setLoading(false), 1200); 

    // 4. Guaranteed cleanup function on unmount or symbol change
    return () => {
      clearTimeout(overlayTimeoutId);
      if (currentContainer) {
        currentContainer.innerHTML = ''; 
      }
    };
  }, [symbol, widgetId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl" style={{ height, width: '100%' }}>
        <AlertTriangle className="text-zinc-600 mb-3" size={28} />
        <p className="text-xs font-bold text-zinc-400">Chart Unavailable</p>
        <p className="text-[10px] text-zinc-500 mt-1">Unable to load data for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="tradingview-widget-container relative rounded-2xl overflow-hidden" style={{ height, width: '100%' }}>
      <div ref={containerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Chart...</p>
        </div>
      )}
    </div>
  );
});

export default TradingViewWidget;