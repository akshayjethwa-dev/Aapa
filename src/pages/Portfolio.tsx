import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';
import { AlertCircle, BarChart3, Plus, Minus, ArrowRightLeft, Calendar } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, cn } from '../lib/utils';

interface PortfolioProps {
  stocks: Record<string, number>;
}

export default function Portfolio({ stocks }: PortfolioProps) {
  const { user } = useAuthStore();
  const [holdings, setHoldings] = useState<any[]>([]);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const res = await apiClient.get('/api/portfolio/holdings');
        setHoldings(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to fetch portfolio', err);
      }
    };
    fetchHoldings();
  }, []);

  const totalInvested = holdings.reduce((acc, h) => acc + (h.quantity * h.average_price), 0);
  const currentValue = holdings.reduce((acc, h) => acc + (h.quantity * (stocks[h.symbol] || h.average_price)), 0);
  const totalPnL = currentValue - totalInvested;
  
  const allocationData = holdings.length > 0 ? holdings.map(h => ({
    name: h.symbol,
    value: h.quantity * (stocks[h.symbol] || h.average_price)
  })) : [{ name: 'Cash', value: user?.balance || 0 }];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-5 pb-24 overflow-y-auto scroll-smooth">
      <div className="px-5 pt-4">
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-6 space-y-5 shadow-2xl">
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
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Portfolio Analytics</h3>
        <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-5 space-y-5">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={6} dataKey="value">
                  {allocationData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }} itemStyle={{ color: '#fff', fontSize: '9px' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Equity Holdings</h3>
          <span className="text-[9px] font-bold text-zinc-700">{holdings.length} Stocks</span>
        </div>
        <div className="space-y-2.5">
          {holdings.map(h => {
            const currentPrice = stocks[h.symbol] || h.average_price;
            const pnl = (currentPrice - h.average_price) * h.quantity;
            return (
              <div key={h.symbol} className="bg-zinc-900/20 border border-zinc-800/30 rounded-xl p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-[11px] text-zinc-500">{h.symbol.substring(0, 2)}</div>
                  <div>
                    <p className="text-[13px] font-bold text-white tracking-tight">{h.symbol}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">{h.quantity} Qty • Avg {formatCurrency(h.average_price)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-white">{formatCurrency(h.quantity * currentPrice)}</p>
                  <p className={cn("text-[9px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}