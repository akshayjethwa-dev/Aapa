import React, { useState, useEffect, useRef } from 'react';

const TradingViewWidget = React.memo(({ symbol, height = "100%" }: { symbol: string, height?: string | number }) => {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!container.current) return;
    
    setLoading(true);
    const currentContainer = container.current;
    
    // Clean up previous widget instance
    currentContainer.innerHTML = '';
    
    // Create the exact DOM structure TradingView expects
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    currentContainer.appendChild(widgetContainer);
    
    const getTradingViewSymbol = (s: string) => {
      if (s.includes(':')) return s;
      
      if (s.includes(' CE') || s.includes(' PE')) {
        const parts = s.split(' ');
        const base = parts[0] === 'NIFTY' ? 'NIFTY' : parts[0] === 'BANKNIFTY' ? 'BANKNIFTY' : parts[0];
        return `NSE:${base}`; 
      }

      const mapping: Record<string, string> = {
        'NIFTY 50': 'NSE:NIFTY',
        'BANKNIFTY': 'NSE:BANKNIFTY',
        'FINNIFTY': 'NSE:CNXFINANCE',
        'MIDCAP NIFTY': 'NSE:NIFTY_MID_SELECT',
        'SENSEX': 'BSE:SENSEX',
        'NIFTY IT': 'NSE:CNXIT',
        'NIFTY AUTO': 'NSE:CNXAUTO',
        'NIFTY PHARMA': 'NSE:CNXPHARMA',
        'NIFTY METAL': 'NSE:CNXMETAL',
        'NIFTY FMCG': 'NSE:CNXFMCG',
        'NIFTY REALTY': 'NSE:CNXREALTY'
      };
      return mapping[s] || `NSE:${s}`;
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    const config = {
      "autosize": true,
      "symbol": getTradingViewSymbol(symbol),
      "interval": "5",
      "timezone": "Asia/Kolkata",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com",
      "hide_side_toolbar": false,
      "withdateranges": true,
      "details": true,
      "hotlist": true,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650"
    };
    
    script.innerHTML = JSON.stringify(config);
    
    // 🚀 FIX: Append synchronously. TradingView relies on document.currentScript 
    // to find its container. If delayed via setTimeout, currentScript becomes null!
    currentContainer.appendChild(script);

    // Fade out the custom loading overlay after 800ms (giving iframe time to paint)
    const overlayTimeoutId = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => {
      clearTimeout(overlayTimeoutId);
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container relative" ref={container} style={{ height, width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loading Real-Time Chart...</p>
        </div>
      )}
    </div>
  );
});

export default TradingViewWidget;