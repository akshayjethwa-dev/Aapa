import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RefreshCw, Activity, TrendingDown, Layers, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

interface OptionData {
  strike: number;
  ce: { ltp: number | null; perc_change: number | null; oi_formatted: string; vol_formatted: string; is_active: boolean; iv: string; delta: string; theta: string; vega: string; };
  pe: { ltp: number | null; perc_change: number | null; oi_formatted: string; vol_formatted: string; is_active: boolean; iv: string; delta: string; theta: string; vega: string; };
}

interface OptionChainProps {
  onPlaceOrder?: (config: any) => void;
  stocks?: Record<string, number>;
  fullChain?: boolean;
}

const OptionChain: React.FC<OptionChainProps> = ({ onPlaceOrder, stocks = {}, fullChain = false }) => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState(''); 
  const [expiries, setExpiries] = useState<string[]>([]);
  const [isExpiriesLoading, setIsExpiriesLoading] = useState(false);
  
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // NEW: Error state
  const [selectedStrike, setSelectedStrike] = useState<{ strike: number; type: 'CE' | 'PE'; price: number } | null>(null);
  const [showGreeks, setShowGreeks] = useState(false);

  const { token, user } = useAuthStore();

  const indexMap: Record<string, string> = {
    'NIFTY': 'NSE_INDEX|Nifty 50',
    'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
    'FINNIFTY': 'NSE_INDEX|Nifty Fin Service'
  };

  // 1. Fetch Dynamic Expiries (Refactored to be callable manually)
  const fetchExpiries = useCallback(async () => {
    if (!token) return;
    setIsExpiriesLoading(true);
    setError(null); // Clear previous errors
    try {
      const instrumentKey = indexMap[symbol] || `NSE_INDEX|${symbol}`;
      const response = await apiClient.get(`/api/option-expiries?instrument_key=${encodeURIComponent(instrumentKey)}`);
      
      if (response.data.status === 'success' && response.data.data.length > 0) {
        setExpiries(response.data.data);
        setExpiry(response.data.data[0]); 
      } else {
        setError(response.data.error || "Failed to load expiries");
      }
    } catch (e: any) {
      console.error("Failed to fetch expiries", e);
      setError(e.response?.data?.error || "Server connection failed while loading expiries.");
    } finally {
      setIsExpiriesLoading(false);
    }
  }, [symbol, token]);

  // 2. Fetch Normalized Option Chain Data (Refactored)
  const fetchOptionChain = useCallback(async (isSilentRefresh = false) => {
    if (!token || !expiry) return; 
    
    // Only show hard loading state if we don't have background data yet
    if (!isSilentRefresh || options.length === 0) {
        setLoading(true);
    }
    
    try {
      const instrumentKey = indexMap[symbol] || `NSE_INDEX|${symbol}`;
      const response = await apiClient.get(`/api/option-chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`);
      const data = response.data; 
      
      if (data.status === 'success' && data.data) {
        setOptions(data.data);
        setError(null); // Clear errors on success
      } else {
        setError(data.error || "Failed to load option chain data.");
      }
    } catch (e: any) {
      console.error("Failed to fetch option chain", e);
      setError(e.response?.data?.error || "Server connection failed. Could not reach broker.");
    } finally {
      setLoading(false);
    }
  }, [symbol, expiry, token, options.length]);

  // Handle Initial Load & Dependencies
  useEffect(() => {
    setOptions([]); // Clear old options when symbol changes
    fetchExpiries();
  }, [fetchExpiries]);

  // Handle Chain Fetching & Polling
  useEffect(() => {
    if (expiry && !error) {
        fetchOptionChain();
        const interval = setInterval(() => fetchOptionChain(true), 5000);
        return () => clearInterval(interval);
    }
  }, [fetchOptionChain, expiry, error]);

  // 3. ATM Filtering Logic
  const filteredOptions = useMemo(() => {
    if (fullChain || options.length === 0) return options;
    if (user && user.role === 'admin') return options;

    const indexPriceKey = symbol === 'NIFTY' ? 'NIFTY 50' : symbol;
    const spotPrice = stocks[indexPriceKey] || 0;
    
    if (spotPrice === 0) return options;

    const strikeInterval = symbol.includes('BANKNIFTY') ? 100 : 50;
    const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

    const atmIdx = options.findIndex(opt => opt.strike === atmStrike);
    
    if (atmIdx !== -1) {
      return options.slice(Math.max(0, atmIdx - 2), Math.min(options.length, atmIdx + 3));
    } else {
      let closestIdx = 0;
      let minDiff = Math.abs(options[0].strike - spotPrice);
      for (let i = 1; i < options.length; i++) {
        const diff = Math.abs(options[i].strike - spotPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      return options.slice(Math.max(0, closestIdx - 2), Math.min(options.length, closestIdx + 3));
    }
  }, [options, user, symbol, stocks, fullChain]);

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if (!selectedStrike || !onPlaceOrder) return;
    onPlaceOrder({
      side,
      symbol,
      strike: selectedStrike.strike,
      optionType: selectedStrike.type,
      expiry,
      price: selectedStrike.price
    });
    setSelectedStrike(null);
  };

  const formatExpiryDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };

  const handleManualRetry = () => {
      setError(null);
      if (expiries.length === 0) {
          fetchExpiries();
      } else {
          fetchOptionChain();
      }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight uppercase">Option Chain</h2>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Derivatives Data</p>
            </div>
          </div>
          <button 
            onClick={() => fetchOptionChain()}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="relative group col-span-1">
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all"
            >
              <option value="NIFTY">NIFTY 50</option>
              <option value="BANKNIFTY">BANKNIFTY</option>
              <option value="FINNIFTY">FINNIFTY</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>
          
          <div className="relative group col-span-1">
            <select 
              value={expiry} 
              onChange={(e) => setExpiry(e.target.value)}
              disabled={isExpiriesLoading || expiries.length === 0}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
            >
              {isExpiriesLoading ? (
                <option value="">Loading...</option>
              ) : expiries.length > 0 ? (
                expiries.map(dateStr => (
                  <option key={dateStr} value={dateStr}>
                    {formatExpiryDisplay(dateStr)}
                  </option>
                ))
              ) : (
                <option value="">No Expiries</option>
              )}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          {/* Toggle Greeks Button */}
          <button 
            onClick={() => setShowGreeks(!showGreeks)}
            className={cn(
              "col-span-1 flex items-center justify-center gap-2 rounded-xl text-[11px] font-bold transition-all border",
              showGreeks 
                ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            <Layers size={14} />
            {showGreeks ? 'Hide Greeks' : 'Show Greeks'}
          </button>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl overflow-hidden min-h-75">
        <div className="overflow-x-auto scrollbar-hide h-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50 border-b border-zinc-800/50">
                <th colSpan={2} className="px-3 py-2 text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest border-r border-zinc-800/50">Calls (CE)</th>
                <th className="px-3 py-2 text-center text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/80">Strike</th>
                <th colSpan={2} className="px-3 py-2 text-center text-[9px] font-black text-rose-500 uppercase tracking-widest border-l border-zinc-800/50">Puts (PE)</th>
              </tr>
              <tr className="bg-zinc-900/30 border-b border-zinc-800/50 text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                <th className="px-2 py-1.5 text-center w-1/5">OI</th>
                <th className="px-2 py-1.5 text-center w-1/5 border-r border-zinc-800/50">LTP</th>
                <th className="px-2 py-1.5 text-center w-1/5 bg-zinc-900/50">Price</th>
                <th className="px-2 py-1.5 text-center w-1/5 border-l border-zinc-800/50">LTP</th>
                <th className="px-2 py-1.5 text-center w-1/5">OI</th>
              </tr>
            </thead>
            
            {/* DYNAMIC TBODY: Handles Error, Loading, and Data States */}
            <tbody className="divide-y divide-zinc-800/30">
              
              {/* STATE: Error Occurred */}
              {error ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <div className="flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-3">
                        <AlertTriangle size={24} className="text-rose-500" />
                      </div>
                      <p className="text-sm font-bold text-zinc-300 mb-1">Option Chain Unavailable</p>
                      <p className="text-[11px] text-zinc-500 max-w-62.5 mb-4">{error}</p>
                      <button 
                        onClick={handleManualRetry}
                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </td>
                </tr>
              ) : 
              
              /* STATE: Initial Loading (Skeleton) */
              loading && options.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-2 py-4 border-r border-zinc-800/50">
                      <div className="h-3 bg-zinc-800/50 rounded w-8 mx-auto"></div>
                    </td>
                    <td className="px-2 py-4 border-r border-zinc-800/50">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-4 bg-zinc-800/80 rounded w-10"></div>
                        <div className="h-2 bg-zinc-800/40 rounded w-6"></div>
                      </div>
                    </td>
                    <td className="px-2 py-4 bg-zinc-900/50">
                      <div className="h-4 bg-zinc-700/50 rounded w-12 mx-auto"></div>
                    </td>
                    <td className="px-2 py-4 border-l border-zinc-800/50">
                       <div className="flex flex-col items-center gap-1">
                        <div className="h-4 bg-zinc-800/80 rounded w-10"></div>
                        <div className="h-2 bg-zinc-800/40 rounded w-6"></div>
                      </div>
                    </td>
                    <td className="px-2 py-4 border-l border-zinc-800/50">
                       <div className="h-3 bg-zinc-800/50 rounded w-8 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : 
              
              /* STATE: Data Loaded Successfully */
              filteredOptions.map((opt, idx) => (
                <React.Fragment key={idx}>
                  <tr className="group hover:bg-zinc-900/40 transition-colors">
                    <td className="px-2 py-3 text-center text-[10px] text-zinc-500 font-medium">
                      {opt.ce.oi_formatted}
                    </td>
                    <td 
                      onClick={() => opt.ce.is_active && setSelectedStrike({ strike: opt.strike, type: 'CE', price: opt.ce.ltp! })}
                      className={cn(
                        "px-2 py-3 text-center transition-all border-r border-zinc-800/50",
                        opt.ce.is_active ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                        selectedStrike?.strike === opt.strike && selectedStrike?.type === 'CE' ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20" : ""
                      )}
                    >
                      {opt.ce.is_active ? (
                        <>
                          <p className="text-[11px] font-black text-white">{opt.ce.ltp!.toFixed(2)}</p>
                          <p className={cn("text-[8px] font-bold", opt.ce.perc_change! >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {opt.ce.perc_change! >= 0 ? '+' : ''}{opt.ce.perc_change!.toFixed(1)}%
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] font-black text-zinc-600">-</p>
                      )}
                    </td>

                    <td className="px-2 py-3 text-center bg-zinc-900/50">
                      <span className="text-[11px] font-black text-zinc-400">{opt.strike}</span>
                    </td>

                    <td 
                      onClick={() => opt.pe.is_active && setSelectedStrike({ strike: opt.strike, type: 'PE', price: opt.pe.ltp! })}
                      className={cn(
                        "px-2 py-3 text-center transition-all border-l border-zinc-800/50",
                        opt.pe.is_active ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                        selectedStrike?.strike === opt.strike && selectedStrike?.type === 'PE' ? "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20" : ""
                      )}
                    >
                      {opt.pe.is_active ? (
                        <>
                          <p className="text-[11px] font-black text-white">{opt.pe.ltp!.toFixed(2)}</p>
                          <p className={cn("text-[8px] font-bold", opt.pe.perc_change! >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {opt.pe.perc_change! >= 0 ? '+' : ''}{opt.pe.perc_change!.toFixed(1)}%
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] font-black text-zinc-600">-</p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center text-[10px] text-zinc-500 font-medium">
                      {opt.pe.oi_formatted}
                    </td>
                  </tr>

                  {/* Expandable Greeks Row */}
                  {showGreeks && (
                    <tr className="bg-zinc-900/30 text-[9px] font-medium text-zinc-500 border-b border-zinc-800/30 shadow-inner">
                      <td colSpan={2} className="px-2 py-2 border-r border-zinc-800/50">
                        <div className="flex items-center justify-around w-full">
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">IV</span>
                            <span className="text-purple-400">{opt.ce.iv}%</span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">Delta</span>
                            <span className="text-zinc-300">{opt.ce.delta}</span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">Theta</span>
                            <span className="text-zinc-300">{opt.ce.theta}</span>
                          </span>
                        </div>
                      </td>
                      <td className="bg-zinc-900/50"></td>
                      <td colSpan={2} className="px-2 py-2 border-l border-zinc-800/50">
                        <div className="flex items-center justify-around w-full">
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">IV</span>
                            <span className="text-purple-400">{opt.pe.iv}%</span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">Delta</span>
                            <span className="text-zinc-300">{opt.pe.delta}</span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[8px] uppercase tracking-wider opacity-60">Theta</span>
                            <span className="text-zinc-300">{opt.pe.theta}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Bar */}
      <AnimatePresence>
        {selectedStrike && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 z-100 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                selectedStrike.type === 'CE' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {selectedStrike.type}
              </div>
              <div>
                <p className="text-xs font-black text-white tracking-tight">{symbol} {selectedStrike.strike}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">LTP: ₹{selectedStrike.price.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleTrade('SELL')}
                className="px-6 py-2.5 bg-rose-500 text-black font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Sell
              </button>
              <button 
                onClick={() => handleTrade('BUY')}
                className="px-6 py-2.5 bg-emerald-500 text-black font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Buy
              </button>
              <button 
                onClick={() => setSelectedStrike(null)}
                className="p-2.5 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors"
              >
                <TrendingDown size={18} className="rotate-45" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OptionChain;