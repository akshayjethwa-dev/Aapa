import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, History, ArrowRight, AlertCircle, BarChart3, Calendar, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
// ✅ FIX: Use apiClient for auto auth headers + token refresh
import { apiClient } from '../api/client';

const Portfolio = ({ stocks }: { stocks: Record<string, number> }) => {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        // ✅ FIX 1: Correct endpoint '/api/portfolio' (NOT '/api/portfolio/holdings')
        // ✅ FIX 2: Use apiClient (not raw fetch) for automatic auth + refresh
        const res = await apiClient.get('/api/portfolio');
        const data = Array.isArray(res.data) ? res.data : [];
        setHoldings(data);
      } catch (err) {
        console.error('Failed to fetch portfolio', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHoldings();
  }, []);

  // Holdings from Upstox shape: { symbol, quantity, average_price, current_price, broker }
  const totalInvested = holdings.reduce((acc, h) => acc + h.quantity * h.average_price, 0);

  // ✅ FIX 3: Use stocks[h.symbol] + h.current_price as live price sources
  const currentValue = holdings.reduce((acc, h) => {
    const ltp =
      stocks[h.symbol] ||       // live WebSocket price
      h.current_price ||         // Upstox API snapshot fallback
      h.average_price;           // last resort
    return acc + h.quantity * ltp;
  }, 0);

  const totalPnL = currentValue - totalInvested;
  const dayPnL = totalPnL * 0.05;

  const allocationData = holdings.length > 0
    ? holdings.map(h => ({
        name: h.symbol,
        value: h.quantity * (stocks[h.symbol] || h.current_price || h.average_price)
      }))
    : [{ name: 'Cash', value: user?.balance || 0 }];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const mfHoldings = [
    { name: 'Quant Small Cap Fund', amount: 45000, pnl: 12400, type: 'Equity' },
    { name: 'Parag Parikh Flexi Cap', amount: 85000, pnl: 18500, type: 'Equity' },
  ];

  const sipInvestments = [
    { name: 'HDFC Index Fund Nifty 50', amount: 5000, date: '05 Mar 2026' },
    { name: 'ICICI Prudential Bluechip', amount: 3000, date: '12 Mar 2026' },
  ];

  return (
    <div className="space-y-5 pb-24 overflow-y-auto scroll-smooth">

      {/* ── Portfolio Summary ── */}
      <div className="px-5 pt-4">
        <div className="bg-linear-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Portfolio Value</p>
            <h2 className="text-3xl font-black tracking-tighter text-white">{formatCurrency(currentValue + (user?.balance || 0))}</h2>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-5 border-t border-zinc-800/50">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Overall P&L</p>
              <p className={cn("text-base font-bold", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Day P&L</p>
              <p className={cn("text-base font-bold", dayPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {dayPnL >= 0 ? '+' : ''}{formatCurrency(dayPnL)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Analytics ── */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Portfolio Analytics</h3>
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-5 space-y-5">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={6} dataKey="value">
                  {allocationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '9px', fontWeight: 'bold' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/50">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Risk Score</p>
              <div className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-500 uppercase">Moderate</span>
              </div>
            </div>
            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/50">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Sector Exposure</p>
              <div className="flex items-center gap-1.5">
                <BarChart3 size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold text-white uppercase">IT & Banking</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Equity Holdings ── */}
      <div className="px-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Equity Holdings</h3>
          <span className="text-[9px] font-bold text-zinc-700">{holdings.length} Stocks</span>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800" />
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-zinc-800 rounded" />
                    <div className="h-2 w-14 bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="space-y-2 items-end flex flex-col">
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                  <div className="h-2 w-10 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && holdings.length === 0 && (
          <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-8 text-center space-y-2">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">No holdings found</p>
            <p className="text-[10px] text-zinc-700">Connect your Upstox account and your equity holdings will appear here.</p>
          </div>
        )}

        {/* Holdings list */}
        <div className="space-y-2.5">
          {holdings.map(h => {
            const ltp = stocks[h.symbol] || h.current_price || h.average_price;
            const pnl = (ltp - h.average_price) * h.quantity;
            return (
              <div key={h.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">
                    {h.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white tracking-tight">{h.symbol}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">
                      {h.quantity} Qty • Avg {formatCurrency(h.average_price)}
                      {h.broker && <span className="ml-1 text-zinc-700">• {h.broker}</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-white">{formatCurrency(h.quantity * ltp)}</p>
                  <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mutual Funds ── */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Mutual Funds</h3>
        <div className="space-y-2.5">
          {mfHoldings.map((mf, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-white tracking-tight">{mf.name}</p>
                <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{mf.type} • Invested {formatCurrency(mf.amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(mf.amount + mf.pnl)}</p>
                <p className="text-[9px] font-bold text-emerald-500">+{formatCurrency(mf.pnl)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SIP Investments ── */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">SIP Investments</h3>
        <div className="space-y-2.5">
          {sipInvestments.map((sip, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{sip.name}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">Monthly {formatCurrency(sip.amount)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Next SIP</p>
                <p className="text-[11px] font-bold text-white mt-0.5">{sip.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Transaction History</h3>
        <div className="space-y-2.5">
          {[
            { type: 'Deposit', amount: 50000, date: '25 Feb 2026', status: 'Success' },
            { type: 'Buy', amount: 12450, date: '22 Feb 2026', status: 'Success', symbol: 'TCS' },
            { type: 'Withdraw', amount: 5000, date: '18 Feb 2026', status: 'Success' },
          ].map((tx, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl",
                  tx.type === 'Deposit' ? "bg-emerald-500/10 text-emerald-500" :
                  tx.type === 'Withdraw' ? "bg-rose-500/10 text-rose-500" :
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {tx.type === 'Deposit' ? <Plus size={16} /> : tx.type === 'Withdraw' ? <Minus size={16} /> : <ArrowRightLeft size={16} />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white tracking-tight">{tx.type} {tx.symbol ? `• ${tx.symbol}` : ''}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white">{formatCurrency(tx.amount)}</p>
                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">{tx.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Portfolio;