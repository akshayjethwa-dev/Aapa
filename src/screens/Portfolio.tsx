// src/screens/Portfolio.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, RefreshCw,
  ExternalLink, Info, PlusCircle, ChevronRight, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FundsSegment {
  available_margin: number;
  used_margin: number;
  opening_balance: number;
  collateral: number;
  span_margin: number;
  exposure_margin: number;
  option_premium: number;
}
interface FundsData {
  available: number;
  used: number;
  opening_balance: number;
  collateral: number;
  equity: FundsSegment;
  fno: FundsSegment;
}
interface Holding {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  close_price: number;
  day_change: number;
  day_change_pct: number;
  broker: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

const fmtCr = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${fmt(n)}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────
const MetricRow = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
    <span className="text-gray-400 text-sm">{label}</span>
    <span className={`text-sm font-semibold tabular-nums ${accent ?? 'text-white'}`}>{value}</span>
  </div>
);

const SegmentCard = ({
  title, segment, color
}: { title: string; segment: FundsSegment; color: string }) => {
  const total = segment.available_margin + segment.used_margin;
  const usedPct = total > 0 ? (segment.used_margin / total) * 100 : 0;

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-white font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs text-gray-500">
          ₹{fmt(segment.available_margin)} free
        </span>
      </div>

      {/* Margin utilisation bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>

      <div className="space-y-0">
        <MetricRow label="Available"       value={`₹${fmt(segment.available_margin)}`} accent="text-emerald-400" />
        <MetricRow label="Used"            value={`₹${fmt(segment.used_margin)}`}      accent="text-amber-400" />
        <MetricRow label="Opening Balance" value={`₹${fmt(segment.opening_balance)}`} />
        {segment.collateral > 0 &&
          <MetricRow label="Collateral"    value={`₹${fmt(segment.collateral)}`} />}
        {segment.span_margin > 0 &&
          <MetricRow label="SPAN Margin"   value={`₹${fmt(segment.span_margin)}`} />}
        {segment.exposure_margin > 0 &&
          <MetricRow label="Exposure"      value={`₹${fmt(segment.exposure_margin)}`} />}
        {segment.option_premium > 0 &&
          <MetricRow label="Option Premium" value={`₹${fmt(segment.option_premium)}`} />}
      </div>
    </div>
  );
};

// ─── FundsTab ─────────────────────────────────────────────────────────────────
const FundsTab = ({
  funds, loading, error, onRefresh, upstoxConnected
}: {
  funds: FundsData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  upstoxConnected: boolean;
}) => {
  const totalAvailable = funds?.available ?? 0;
  const totalUsed = funds?.used ?? 0;
  const totalCapital = totalAvailable + totalUsed;
  const usedPct = totalCapital > 0 ? (totalUsed / totalCapital) * 100 : 0;

  // Deep-link to Upstox add funds
  const handleAddFunds = () => {
    window.open('https://login.upstox.com/add-funds', '_blank', 'noopener,noreferrer');
  };

  if (!upstoxConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-white font-semibold text-lg mb-2">Broker Not Connected</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Connect your Upstox account to see real-time funds and margin data.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {/* Skeleton */}
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* ── Hero Summary Card ── */}
      <div className="mx-4 mt-4 bg-linear-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Available to Trade</span>
          <button onClick={onRefresh} className="p-1 rounded-full hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="text-3xl font-bold text-white tabular-nums mb-1">
          ₹{fmt(totalAvailable)}
        </div>
        <p className="text-gray-500 text-xs mb-4">
          Opening: ₹{fmt(funds?.opening_balance ?? 0)}
          {(funds?.collateral ?? 0) > 0 && ` · Collateral: ₹${fmt(funds!.collateral)}`}
        </p>

        {/* Overall utilisation bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Margin Utilised</span>
            <span>{usedPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs mt-2">
          <span className="text-emerald-400">▲ Free ₹{fmtCr(totalAvailable)}</span>
          <span className="text-amber-400">▼ Used ₹{fmtCr(totalUsed)}</span>
        </div>

        {/* Add Funds CTA */}
        <button
          onClick={handleAddFunds}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Add Funds via Upstox
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </button>
      </div>

      {/* ── Segment Breakdown ── */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400 text-xs uppercase tracking-wider">Segment Breakdown</span>
        </div>
        <div className="space-y-3">
          {funds?.equity && (
            <SegmentCard title="Equity (EQ)" segment={funds.equity} color="bg-blue-500" />
          )}
          {funds?.fno && (
            <SegmentCard title="Futures & Options (F&O)" segment={funds.fno} color="bg-purple-500" />
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mx-4 mt-4 text-xs text-gray-600 leading-relaxed">
        Margin values are fetched live from Upstox. Collateral and SPAN are updated by the exchange at risk intervals.
      </p>
    </div>
  );
};

// ─── HoldingsTab (existing, unchanged) ───────────────────────────────────────
const HoldingsTab = ({ holdings, loading }: { holdings: Holding[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!holdings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <TrendingUp className="w-12 h-12 text-gray-700 mb-4" />
        <h3 className="text-white font-semibold mb-1">No Holdings Yet</h3>
        <p className="text-gray-400 text-sm">Long-term equity holdings will appear here.</p>
      </div>
    );
  }

  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0);
  const totalCurrent  = holdings.reduce((s, h) => s + h.current_price * h.quantity, 0);
  const totalPnl      = totalCurrent - totalInvested;
  const totalPct      = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const isPos         = totalPnl >= 0;

  return (
    <div className="pb-6">
      {/* Summary */}
      <div className="mx-4 mt-4 bg-gray-900 rounded-xl p-4 border border-gray-800 flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Current Value</p>
          <p className="text-white text-xl font-bold tabular-nums">₹{fmt(totalCurrent)}</p>
          <p className="text-gray-500 text-xs">Invested ₹{fmt(totalInvested)}</p>
        </div>
        <div className={`text-right ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
          <p className="text-lg font-bold tabular-nums">{isPos ? '+' : ''}₹{fmt(totalPnl)}</p>
          <p className="text-sm">{isPos ? '+' : ''}{totalPct.toFixed(2)}%</p>
        </div>
      </div>

      {/* Holdings list */}
      <div className="px-4 mt-4 space-y-2">
        {holdings.map((h, i) => {
          const invested = h.average_price * h.quantity;
          const current  = h.current_price * h.quantity;
          const pnl      = current - invested;
          const pct      = invested > 0 ? (pnl / invested) * 100 : 0;
          const isP      = pnl >= 0;

          return (
            <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white font-semibold text-sm truncate">{h.symbol}</span>
                  <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{h.broker}</span>
                </div>
                <p className="text-gray-500 text-xs">{h.quantity} shares · Avg ₹{fmt(h.average_price)}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-white font-semibold text-sm tabular-nums">₹{fmt(h.current_price)}</p>
                <p className={`text-xs tabular-nums ${isP ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isP ? '+' : ''}₹{fmt(pnl)} ({isP ? '+' : ''}{pct.toFixed(2)}%)
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Portfolio Screen ────────────────────────────────────────────────────
const TABS = ['Holdings', 'Funds'] as const;
type Tab = typeof TABS[number];

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<Tab>('Holdings');
  const [holdings, setHoldings]   = useState<Holding[]>([]);
  const [funds, setFunds]         = useState<FundsData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [upstoxConnected, setUpstoxConnected] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') ?? sessionStorage.getItem('token') ?? '';
      const res   = await fetch('/api/portfolio', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setHoldings(data.holdings ?? []);

      // Support both legacy number and new structured FundsData
      if (data.funds && typeof data.funds === 'object' && 'available' in data.funds) {
        setFunds(data.funds as FundsData);
        setUpstoxConnected(true);
      } else if (typeof data.funds === 'number' && data.funds > 0) {
        // Legacy fallback — show as available only
        setFunds({
          available: data.funds,
          used: 0,
          opening_balance: data.funds,
          collateral: 0,
          equity: { available_margin: data.funds, used_margin: 0, opening_balance: data.funds, collateral: 0, span_margin: 0, exposure_margin: 0, option_premium: 0 },
          fno:    { available_margin: 0, used_margin: 0, opening_balance: 0, collateral: 0, span_margin: 0, exposure_margin: 0, option_premium: 0 },
        });
        setUpstoxConnected(true);
      } else {
        setUpstoxConnected(false);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-4 pt-12 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h1 className="text-white font-bold text-lg">Portfolio</h1>
          </div>
          <button
            onClick={fetchPortfolio}
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'Holdings' && (
        <HoldingsTab holdings={holdings} loading={loading} />
      )}
      {activeTab === 'Funds' && (
        <FundsTab
          funds={funds}
          loading={loading}
          error={error}
          onRefresh={fetchPortfolio}
          upstoxConnected={upstoxConnected}
        />
      )}
    </div>
  );
}