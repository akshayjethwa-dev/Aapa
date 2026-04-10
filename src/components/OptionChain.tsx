import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, RefreshCw, Activity, Zap, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client'; // <-- Import apiClient

interface OptionData {
  strike: number;
  ce: {
    ltp: number;
    change: number;
    oi: string;
    volume: string;
  };
  pe: {
    ltp: number;
    change: number;
    oi: string;
    volume: string;
  };
}

interface OptionChainProps {
  onPlaceOrder?: (config: any) => void;
  stocks?: Record<string, number>;
  fullChain?: boolean;
}

const OptionChain: React.FC<OptionChainProps> = ({ onPlaceOrder, stocks = {}, fullChain = false }) => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('04 APR 2024');
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrike, setSelectedStrike] = useState<{ strike: number; type: 'CE' | 'PE'; price: number } | null>(null);

  const { token, user } = useAuthStore();

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const indexMap: Record<string, string> = {
          'NIFTY': 'NSE_INDEX|Nifty 50',
          'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
          'FINNIFTY': 'NSE_INDEX|Nifty Fin Service'
        };
        const instrumentKey = indexMap[symbol] || `NSE_INDEX|${symbol}`;
        
        // --> USING APICLIENT (No manual headers needed!)
        const response = await apiClient.get(`/api/option-chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`);
        const data = response.data; // Axios puts JSON in .data
        
        if (data.status === 'success' && data.data) {
          const formattedData: OptionData[] = data.data.map((item: any) => ({
            strike: item.strike_price,
            ce: {
              ltp: item.call_options?.market_data?.ltp || 0,
              change: item.call_options?.market_data?.perc_change || 0,
              oi: (item.call_options?.market_data?.oi / 100000).toFixed(1) + 'L',
              volume: (item.call_options?.market_data?.volume / 1000).toFixed(1) + 'K',
            },
            pe: {
              ltp: item.put_options?.market_data?.ltp || 0,
              change: item.put_options?.market_data?.perc_change || 0,
              oi: (item.put_options?.market_data?.oi / 100000).toFixed(1) + 'L',
              volume: (item.put_options?.market_data?.volume / 1000).toFixed(1) + 'K',
            }
          }));
          setOptions(formattedData);
        }
      } catch (e) {
        console.error("Failed to fetch option chain", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [symbol, expiry, token]);

  const filteredOptions = useMemo(() => {
    if (fullChain) return options;
    if (!user || user.role !== 'user' || options.length === 0) return options;

    const indexPriceKey = symbol === 'NIFTY' ? 'NIFTY 50' : symbol;
    const spotPrice = stocks[indexPriceKey] || 0;
    if (spotPrice === 0) return options;

    const strikeInterval = symbol.includes('BANKNIFTY') ? 100 : 50;
    const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

    const atmIdx = options.findIndex(opt => opt.strike === atmStrike);
    
    if (atmIdx !== -1) {
      return options.slice(Math.max(0, atmIdx - 1), Math.min(options.length, atmIdx + 2));
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
      return options.slice(Math.max(0, closestIdx - 1), Math.min(options.length, closestIdx + 2));
    }
  }, [options, user, symbol, stocks]);

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if (!selectedStrike || !onPlaceOrder) return;
    
    onPlaceOrder({
      side,
      symbol: `${symbol} ${selectedStrike.strike} ${selectedStrike.type}`,
      strike: selectedStrike.strike,
      optionType: selectedStrike.type,
      expiry,
      price: selectedStrike.price
    });
    setSelectedStrike(null);
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
          <button className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="relative group">
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
          
          <div className="relative group">
            <select 
              value={expiry} 
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all"
            >
              <option value="04 APR 2024">04 APR 2024</option>
              <option value="11 APR 2024">11 APR 2024</option>
              <option value="18 APR 2024">18 APR 2024</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Sentiment Indicators */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-1">
          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Max Pain</p>
          <p className="text-[12px] font-black text-blue-500">{symbol === 'NIFTY' ? '22,350' : '47,600'}</p>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-1">
          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">PCR</p>
          <p className="text-[12px] font-black text-emerald-500">0.92</p>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 space-y-1">
          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">India VIX</p>
          <p className="text-[12px] font-black text-purple-500">12.45</p>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50 border-b border-zinc-800/50">
                <th colSpan={2} className="px-3 py-2 text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest border-r border-zinc-800/50">Calls (CE)</th>
                <th className="px-3 py-2 text-center text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/80">Strike</th>
                <th colSpan={2} className="px-3 py-2 text-center text-[9px] font-black text-rose-500 uppercase tracking-widest border-l border-zinc-800/50">Puts (PE)</th>
              </tr>
              <tr className="bg-zinc-900/30 border-b border-zinc-800/50 text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                <th className="px-2 py-1.5 text-center">OI</th>
                <th className="px-2 py-1.5 text-center border-r border-zinc-800/50">LTP</th>
                <th className="px-2 py-1.5 text-center bg-zinc-900/50">Price</th>
                <th className="px-2 py-1.5 text-center border-l border-zinc-800/50">LTP</th>
                <th className="px-2 py-1.5 text-center">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {filteredOptions.map((opt, idx) => (
                <tr key={idx} className="group hover:bg-zinc-900/40 transition-colors">
                  {/* CE Side */}
                  <td className="px-2 py-3 text-center text-[10px] text-zinc-500 font-medium">{opt.ce.oi}</td>
                  <td 
                    onClick={() => setSelectedStrike({ strike: opt.strike, type: 'CE', price: opt.ce.ltp })}
                    className={cn(
                      "px-2 py-3 text-center cursor-pointer transition-all border-r border-zinc-800/50",
                      selectedStrike?.strike === opt.strike && selectedStrike?.type === 'CE' ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20" : ""
                    )}
                  >
                    <p className="text-[11px] font-black text-white">{opt.ce.ltp.toFixed(2)}</p>
                    <p className={cn("text-[8px] font-bold", opt.ce.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {opt.ce.change >= 0 ? '+' : ''}{opt.ce.change.toFixed(1)}%
                    </p>
                  </td>

                  {/* Strike */}
                  <td className="px-2 py-3 text-center bg-zinc-900/50">
                    <span className="text-[11px] font-black text-zinc-400">{opt.strike}</span>
                  </td>

                  {/* PE Side */}
                  <td 
                    onClick={() => setSelectedStrike({ strike: opt.strike, type: 'PE', price: opt.pe.ltp })}
                    className={cn(
                      "px-2 py-3 text-center cursor-pointer transition-all border-l border-zinc-800/50",
                      selectedStrike?.strike === opt.strike && selectedStrike?.type === 'PE' ? "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20" : ""
                    )}
                  >
                    <p className="text-[11px] font-black text-white">{opt.pe.ltp.toFixed(2)}</p>
                    <p className={cn("text-[8px] font-bold", opt.pe.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {opt.pe.change >= 0 ? '+' : ''}{opt.pe.change.toFixed(1)}%
                    </p>
                  </td>
                  <td className="px-2 py-3 text-center text-[10px] text-zinc-500 font-medium">{opt.pe.oi}</td>
                </tr>
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