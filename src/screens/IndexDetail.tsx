import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Filter, Target, Layers, ChevronDown, BarChart3, Settings2, AlertCircle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import OptionChain from '../components/OptionChain';
import { INDEX_CONSTITUENTS, F_O_INDICES } from '../constants/marketData';
import { useAuthStore } from '../store/authStore';
import FullChartModal from '../components/FullChartModal';

const IndexDetail = ({ indexName, stocks, onClose, onPlaceOrder }: { 
  indexName: string, 
  stocks: Record<string, number>, 
  onClose: () => void,
  onPlaceOrder: (config: any) => void
}) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'Stocks' | 'Option Chain'>(F_O_INDICES.includes(indexName) || indexName === 'SENSEX' ? 'Option Chain' : 'Stocks');
  const [expiry, setExpiry] = useState('2026-03-05'); // Default to next expiry
  const [selectedStrike, setSelectedStrike] = useState<any>(null);
  const [optionChainData, setOptionChainData] = useState<any[]>([]);
  const [loadingChain, setLoadingChain] = useState(false);
  const [activeChart, setActiveChart] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atmRef = useRef<HTMLDivElement>(null);
  
  const isFO = F_O_INDICES.includes(indexName) || indexName === 'SENSEX';
  const constituents = INDEX_CONSTITUENTS[indexName] || [];
  const spotPrice = stocks[indexName] || 0;
  
  const high = spotPrice * 1.005;
  const low = spotPrice * 0.992;

  const expiries = ['2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26'];
  const strikeInterval = indexName.includes('BANKNIFTY') ? 100 : 50;

  useEffect(() => {
    if (isFO && activeTab === 'Option Chain' && spotPrice > 0) {
      const fetchChain = async () => {
        setLoadingChain(true);
        try {
          const indexMap: Record<string, string> = {
            'NIFTY 50': 'NSE_INDEX|Nifty 50',
            'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
            'FINNIFTY': 'NSE_INDEX|Nifty Fin Service',
            'MIDCAP NIFTY': 'NSE_INDEX|Nifty Midcap 100',
            'SENSEX': 'BSE_INDEX|SENSEX'
          };
          const instrumentKey = indexMap[indexName] || `NSE_EQ|${indexName}`;
          const res = await fetch(`/api/option-chain?instrument_key=${instrumentKey}&expiry_date=${expiry}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) throw new Error('Failed to fetch option chain');
          const data = await res.json();
          if (data.status === 'success') {
            setOptionChainData(data.data);
          }
        } catch (e) {
          console.error("Failed to fetch option chain", e);
        } finally {
          setLoadingChain(false);
        }
      };
      fetchChain();
    }
  }, [indexName, expiry, activeTab, spotPrice]);

  const jumpToATM = () => {
    atmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Simulate LTP updates for flashing effect
  const [ltpUpdates, setLtpUpdates] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const interval = setInterval(() => {
      if (optionChainData.length > 0) {
        const randomIdx = Math.floor(Math.random() * optionChainData.length);
        const strike = optionChainData[randomIdx].strike_price;
        setLtpUpdates(prev => ({ ...prev, [strike]: true }));
        setTimeout(() => {
          setLtpUpdates(prev => ({ ...prev, [strike]: false }));
        }, 500);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [optionChainData]);

  const filteredChainData = useMemo(() => {
    return optionChainData;
  }, [optionChainData]);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-70 bg-zinc-50 flex flex-col text-zinc-900"
    >
      {/* Institutional Header */}
      <div className="px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between bg-white sticky top-0 z-60">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[13px] font-bold tracking-tight text-zinc-900">{indexName}</h2>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Option Chain</p>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="relative group">
            <select 
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="bg-zinc-100 text-zinc-900 text-[10px] font-bold pl-2.5 pr-7 py-1 rounded-full border-none outline-none appearance-none cursor-pointer hover:bg-zinc-200 transition-colors"
            >
              {expiries.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => setActiveChart({ symbol: indexName, ltp: spotPrice })}
            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors"
          >
            <BarChart3 size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Filter size={16} />
          </button>
          <button className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeChart && (
          <FullChartModal 
            key="full-chart-modal"
            instrument={activeChart} 
            onClose={() => setActiveChart(null)} 
          />
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide flex flex-col bg-white" ref={scrollRef}>
        {/* Day High/Low - Minimalist */}
        <div className="px-4 py-1.5 bg-zinc-50/50 border-b border-zinc-100 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Day High</span>
            <span className="text-[10px] font-bold text-emerald-600">{high.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Day Low</span>
            <span className="text-[10px] font-bold text-rose-600">{low.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {isFO && activeTab === 'Option Chain' ? (
          <div className="flex-1 flex flex-col relative">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_90px_1fr] border-b border-zinc-100 bg-white sticky top-0 z-30">
              <div className="py-2 text-center border-r border-zinc-100">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Call Price</span>
              </div>
              <div className="py-2 text-center bg-zinc-50/50">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Strike</span>
              </div>
              <div className="py-2 text-center border-l border-zinc-100">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Put Price</span>
              </div>
            </div>

            {/* Option Chain Rows */}
            <div className="divide-y divide-zinc-50 relative">
              {loadingChain ? (
                <div className="py-20 text-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loading Chain...</p>
                </div>
              ) : filteredChainData.length > 0 ? (
                filteredChainData.map((row: any, i: number) => {
                  const strike = row.strike_price;
                  const isATM = Math.abs(strike - spotPrice) < (strikeInterval / 2);
                  const isCallITM = strike < spotPrice;
                  const isPutITM = strike > spotPrice;

                  const callLtp = row.call_options?.market_data?.ltp || 0;
                  const putLtp = row.put_options?.market_data?.ltp || 0;
                  const callChange = row.call_options?.market_data?.perc_change || 0;
                  const putChange = row.put_options?.market_data?.perc_change || 0;

                  return (
                    <div 
                      key={strike} 
                      ref={isATM ? atmRef : null}
                      onClick={() => setSelectedStrike(null)}
                      className={cn(
                        "grid grid-cols-[1fr_90px_1fr] transition-colors relative group",
                        isATM ? "bg-emerald-50/30" : "hover:bg-zinc-50/50"
                      )}
                    >
                      {/* ATM Full Width Line */}
                      {isATM && (
                        <div className="absolute inset-x-0 top-0 h-px bg-emerald-500/50 z-20" />
                      )}

                      {/* CALL SIDE */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStrike({ strike, type: 'CE', price: callLtp });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 border-r border-zinc-100 cursor-pointer transition-all",
                          isCallITM && "bg-emerald-50/10",
                          selectedStrike?.strike === strike && selectedStrike?.type === 'CE' && "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
                        )}
                      >
                        <motion.span 
                          animate={ltpUpdates[strike] ? { scale: [1, 1.05, 1], color: ['#18181b', '#059669', '#18181b'] } : {}}
                          className="text-[13px] font-bold text-zinc-900"
                        >
                          {callLtp.toFixed(2)}
                        </motion.span>
                        <span className={cn("text-[9px] font-medium", callChange >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {callChange >= 0 ? '+' : ''}{callChange.toFixed(2)}%
                        </span>
                      </div>

                      {/* STRIKE PRICE */}
                      <div className={cn(
                        "flex flex-col items-center justify-center py-2.5 bg-zinc-50/30 relative",
                        isATM && "bg-emerald-100/20"
                      )}>
                        <span className={cn(
                          "tracking-tight transition-all",
                          isATM ? "text-base font-black text-emerald-700 scale-105" : "text-[13px] font-bold text-zinc-400"
                        )}>
                          {strike}
                        </span>
                      </div>

                      {/* PUT SIDE */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStrike({ strike, type: 'PE', price: putLtp });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 border-l border-zinc-100 cursor-pointer transition-all",
                          isPutITM && "bg-rose-50/10",
                          selectedStrike?.strike === strike && selectedStrike?.type === 'PE' && "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20"
                        )}
                      >
                        <motion.span 
                          animate={ltpUpdates[strike] ? { scale: [1, 1.05, 1], color: ['#18181b', '#e11d48', '#18181b'] } : {}}
                          className="text-[13px] font-bold text-zinc-900"
                        >
                          {putLtp.toFixed(2)}
                        </motion.span>
                        <span className={cn("text-[9px] font-medium", putChange >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {putChange >= 0 ? '+' : ''}{putChange.toFixed(2)}%
                        </span>
                      </div>

                      {/* Floating ATM Label - Only on ATM row */}
                      {isATM && (
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-50">
                          <div className="bg-black text-white px-3 py-1 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap border border-white/10">
                            <span className="text-[10px] font-black tracking-tight">
                              {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="text-zinc-700" size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No Data Available</p>
                    <p className="text-[9px] text-zinc-600 font-medium px-12">Option chain data is only available during market hours or if Upstox is connected.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 bg-zinc-50 min-h-full pt-3">
            {/* Constituents List - Light Theme */}
            <div className="px-5 space-y-2.5">
              <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Constituents</h3>
              {constituents.map(symbol => (
                <div key={symbol} className="bg-white border border-zinc-200 rounded-xl p-3.5 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-[11px] text-zinc-400">
                      {symbol.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-zinc-900 tracking-tight">{symbol}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase">NSE</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-zinc-900">{formatCurrency(stocks[symbol] || 2500)}</p>
                    <p className="text-[9px] font-bold text-emerald-600">+1.45%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Simplified Bottom Navigation for Index Detail */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-3.5 flex gap-2.5 z-60">
        <AnimatePresence mode="wait">
          {selectedStrike ? (
            <motion.div 
              key="trade-actions"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="flex-1 flex gap-3"
            >
              <button 
                onClick={() => onPlaceOrder({
                  side: 'SELL',
                  symbol: indexName,
                  strike: selectedStrike.strike,
                  optionType: selectedStrike.type,
                  expiry,
                  price: selectedStrike.price
                })}
                className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                SELL
              </button>
              <button 
                onClick={() => onPlaceOrder({
                  side: 'BUY',
                  symbol: indexName,
                  strike: selectedStrike.strike,
                  optionType: selectedStrike.type,
                  expiry,
                  price: selectedStrike.price
                })}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                BUY
              </button>
            </motion.div>
          ) : (
            <button 
              key="jump-to-atm-btn"
              onClick={jumpToATM}
              className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
            >
              Jump to ATM
            </button>
          )}
        </AnimatePresence>
        <button className="w-12 h-12 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors">
          <BarChart3 size={20} />
        </button>
      </div>
    </motion.div>
  );
};

export default IndexDetail;