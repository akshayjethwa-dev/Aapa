import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronDown,
  Zap,
  MousePointer2,
  Activity,
  BarChart3,
  Target,
  ArrowRightLeft,
  XCircle,
  ShieldCheck,
  AlertCircle,
  Lock,
  BarChart2,
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import TradingViewWidget from '../components/TradingViewWidget';
import OptionChain from '../components/OptionChain';
import OrderWindow, { OrderConfig } from './OrderWindow';
import { useAuthStore } from '../store/authStore';
import { F_O_INDICES } from '../constants/marketData';
import { toast } from 'sonner';
import Sparkline from '../components/Sparkline';
import FullChartModal from '../components/FullChartModal';
import { apiClient } from '../api/client';

// ─── FO Gate Banner ───────────────────────────────────────────────────────────
const FOGateBanner = ({
  reason,
  onGoToProfile,
}: {
  reason: 'kyc' | 'risk' | 'segment';
  onGoToProfile: () => void;
}) => {
  const config = {
    kyc: {
      title: 'KYC Required for F&O',
      desc: 'Complete your KYC verification to unlock Futures & Options trading.',
      cta: 'Complete KYC',
      color: 'amber',
    },
    risk: {
      title: 'Risk Profile Required',
      desc: 'Take the risk questionnaire to determine your F&O eligibility.',
      cta: 'Take Quiz',
      color: 'blue',
    },
    segment: {
      title: 'F&O Not Enabled',
      desc: 'Your current risk profile is Conservative or Moderate. Aggressive profile required for F&O access.',
      cta: 'Update Profile',
      color: 'purple',
    },
  }[reason];

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  };
  const btnMap: Record<string, string> = {
    amber: 'bg-amber-500 hover:bg-amber-400 text-black',
    blue: 'bg-blue-500 hover:bg-blue-400 text-black',
    purple: 'bg-purple-500 hover:bg-purple-400 text-black',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mx-4 mt-4 rounded-2xl border p-5 space-y-4 relative overflow-hidden',
        colorMap[config.color]
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Lock size={52} />
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-black/20 shrink-0">
          <Lock size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight">{config.title}</h3>
          <p className="text-[11px] font-medium opacity-80 mt-1 leading-relaxed">
            {config.desc}
          </p>
        </div>
      </div>
      <button
        onClick={onGoToProfile}
        className={cn(
          'w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all',
          btnMap[config.color]
        )}
      >
        {config.cta} →
      </button>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const FOTradingCenter = ({
  stocks,
  onOpenOptionChain,
  onConnectUptox,
  isConnectingUptox,
  onGoToProfile, // NEW prop — pass () => setActiveTab('more') from App.tsx
}: {
  stocks: Record<string, number>;
  onOpenOptionChain: () => void;
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
  onGoToProfile?: () => void;
}) => {
  const { user, token } = useAuthStore();
  const [isScalperMode, setIsScalperMode] = useState(false);
  const [activeChart, setActiveChart] = useState<any>(null);
  const [confirmExit, setConfirmExit] = useState<number | null>(null);
  const [slTgtModal, setSlTgtModal] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestOrder, setLatestOrder] = useState<any>(null);
  const [orderConfig, setOrderConfig] = useState<OrderConfig | null>(null);

  // ── FO eligibility check ──────────────────────────────────────────────────
  const kycApproved = user?.kyc_status === 'approved';
  const hasRiskProfile = !!user?.risk_profile;
  const foEnabled =
    Array.isArray(user?.segments_enabled) &&
    (user.segments_enabled as string[]).includes('FO');
  const isAdmin = user?.role === 'admin';

  // Determine the gate reason (if any)
  const foGateReason: 'kyc' | 'risk' | 'segment' | null = (() => {
    if (isAdmin) return null; // admins bypass
    if (!kycApproved) return 'kyc';
    if (!hasRiskProfile) return 'risk';
    if (!foEnabled) return 'segment';
    return null;
  })();

  const foBlocked = foGateReason !== null;

  // ─────────────────────────────────────────────────────────────────────────
  const fetchPositionsData = useCallback(async () => {
    if (!token) return;
    try {
      const [posRes, ordRes] = await Promise.all([
        apiClient.get('/api/positions'),
        apiClient.get('/api/orders'),
      ]);
      setPositions(Array.isArray(posRes.data) ? posRes.data : []);
      if (Array.isArray(ordRes.data) && ordRes.data.length > 0) {
        setLatestOrder(ordRes.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch FO data', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPositionsData();
    const interval = setInterval(fetchPositionsData, 5000);
    window.addEventListener('broker_portfolio_updated', fetchPositionsData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('broker_portfolio_updated', fetchPositionsData);
    };
  }, [fetchPositionsData]);

  const handleExit = async (index: number) => {
    const pos = positions[index];
    if (isScalperMode || confirmExit === index) {
      toast.info(`Placing exit order for ${pos.symbol}...`);
      setPositions(positions.filter((_, i) => i !== index));
      setConfirmExit(null);
    } else {
      setConfirmExit(index);
      setTimeout(() => setConfirmExit(null), 3000);
    }
  };

  const totalPnL = positions.reduce((acc, pos) => {
    const ltp = pos.ltp ?? pos.current_price ?? 0;
    const avg = pos.avgPrice ?? pos.average_price ?? 0;
    const qty = pos.quantity || 0;
    return acc + (ltp - avg) * qty;
  }, 0);

  const margins = [
    { label: 'Available', value: 1250000, color: 'text-emerald-500' },
    { label: 'Used', value: 450000, color: 'text-rose-500' },
    { label: 'Exposure', value: 180000, color: 'text-blue-500' },
    { label: 'Span', value: 270000, color: 'text-amber-500' },
  ];

  // ── If FO is blocked, show gate wall ──────────────────────────────────────
  if (foBlocked) {
    return (
      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="px-4 pt-10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-purple-500/10">
              <BarChart2 size={22} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight uppercase">
                F&amp;O Trading Center
              </h1>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                Futures &amp; Options
              </p>
            </div>
          </div>
        </div>

        {/* Gate banner */}
        <FOGateBanner
          reason={foGateReason!}
          onGoToProfile={onGoToProfile ?? (() => {})}
        />

        {/* What you'll get once unlocked */}
        <div className="mx-4 mt-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/30 p-5 space-y-4">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            What you unlock with F&amp;O access
          </p>
          {[
            {
              icon: BarChart3,
              color: 'text-purple-400',
              label: 'Live Option Chain — NIFTY, BANKNIFTY, SENSEX',
            },
            {
              icon: Zap,
              color: 'text-amber-400',
              label: 'Scalper Mode for lightning-fast order placement',
            },
            {
              icon: Target,
              color: 'text-blue-400',
              label: 'GTT orders, Trailing SL &amp; multi-leg strategies',
            },
            {
              icon: Activity,
              color: 'text-emerald-400',
              label: 'Real-time position P&amp;L with margin tracking',
            },
            {
              icon: ShieldCheck,
              color: 'text-rose-400',
              label: 'Risk management tools: SL/Target, hedge alerts',
            },
          ].map(({ icon: Icon, color, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={14} className={color} />
              <span
                className="text-[11px] text-zinc-400"
                dangerouslySetInnerHTML={{ __html: label }}
              />
            </div>
          ))}
        </div>

        {/* Steps to unlock */}
        <div className="mx-4 mt-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/30 p-5 space-y-3">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Steps to unlock F&amp;O
          </p>
          {[
            { step: 1, label: 'Complete KYC verification', done: kycApproved },
            {
              step: 2,
              label: 'Connect Upstox broker account',
              done: !!user?.is_uptox_connected,
            },
            { step: 3, label: 'Take risk questionnaire', done: hasRiskProfile },
            {
              step: 4,
              label: 'Score Aggressive on risk profile',
              done: foEnabled,
            },
          ].map(({ step, label, done }) => (
            <div key={step} className="flex items-center gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                  done ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
                )}
              >
                {done ? '✓' : step}
              </div>
              <span
                className={cn(
                  'text-[11px] font-bold',
                  done ? 'text-zinc-400 line-through' : 'text-white'
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Normal FO screen ───────────────────────────
  return (
    <div className="space-y-6 pb-24">
      {/* Live Order Banner */}
      {latestOrder && (
        <div className="px-4 pt-4">
          <div
            className={cn(
              'px-4 py-2.5 rounded-xl border flex items-center justify-between',
              String(latestOrder.status || '')
                .toLowerCase()
                .includes('reject')
                ? 'bg-rose-500/5 border-rose-500/20'
                : String(latestOrder.status || '')
                    .toLowerCase()
                    .includes('complete')
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Latest Order:
              </span>
              <span className="text-xs font-bold text-white">
                {String(latestOrder.symbol || '').replace(' 50', '')}
              </span>
            </div>
            <div
              className={cn(
                'text-[10px] font-black uppercase tracking-widest',
                String(latestOrder.status || '')
                  .toLowerCase()
                  .includes('reject')
                  ? 'text-rose-500'
                  : String(latestOrder.status || '')
                      .toLowerCase()
                      .includes('complete')
                  ? 'text-emerald-500'
                  : 'text-amber-500'
              )}
            >
              {latestOrder.status || 'Pending'}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Requirement Banner */}
      {user?.role === 'pre-onboarding' && (
        <div className={latestOrder ? 'px-4' : 'px-4 pt-4'}>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <AlertCircle size={48} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                <AlertCircle size={14} /> Action Required
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 mt-1">
                You selected that you don't have an Upstox account. Trading is restricted
                until you open one.
              </p>
            </div>
            <a
              href="https://upstox.com/open-demat-account/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-rose-500 hover:bg-rose-600 text-black text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest text-center z-10"
            >
              Complete Upstox Opening
            </a>
          </div>
        </div>
      )}

      {/* Broker Connection for Users */}
      {!user?.is_uptox_connected &&
        user?.role !== 'user' &&
        user?.role !== 'pre-onboarding' && (
          <div className={latestOrder ? 'px-4' : 'px-4 pt-4'}>
            <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    Connect Your Broker
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Link Upstox to start F&O trading
                  </p>
                </div>
              </div>
              <div className="flex justify-center mt-2">
                <button
                  onClick={onConnectUptox}
                  disabled={isConnectingUptox}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 px-4 flex flex-col items-center gap-2 transition-all disabled:opacity-50"
                >
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    Upstox
                  </span>
                  <span className="text-[8px] font-bold text-emerald-500 uppercase">
                    Link Now
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Margin Panel */}
      <div className="px-4 pt-3">
        <div className="overflow-x-auto scrollbar-hide flex gap-2">
          {margins.map((m) => (
            <div
              key={m.label}
              className="min-w-30 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 space-y-0.5"
            >
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                {m.label} Margin
              </p>
              <p className={cn('text-[12px] font-black tracking-tight', m.color)}>
                {formatCurrency(m.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scalper Mode & Summary */}
      <div className="px-4">
        <div className="bg-linear-to-br from-zinc-900 to-black border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center shadow-2xl">
          <div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
              Total Realized P&L
            </p>
            <h2
              className={cn(
                'text-xl font-black tracking-tighter',
                totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
              )}
            >
              {totalPnL >= 0 ? '+' : ''}
              {formatCurrency(totalPnL)}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setIsScalperMode(false)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                  !isScalperMode ? 'bg-zinc-800 text-white' : 'text-zinc-600'
                )}
              >
                Normal
              </button>
              <button
                onClick={() => setIsScalperMode(true)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1',
                  isScalperMode ? 'bg-emerald-500 text-black' : 'text-zinc-600'
                )}
              >
                <Zap size={10} />
                Scalper
              </button>
            </div>
            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
              Speed Mode
            </p>
          </div>
        </div>
      </div>

      {/* Option Chain */}
      <div className="px-4 pt-2">
  <OptionChain
    stocks={stocks}
    onPlaceOrder={(config) => setOrderConfig(config as import('./OrderWindow').OrderConfig)}
    fullChain={isAdmin}
  />
</div>

      {/* Live Positions */}
      <div className="px-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Activity size={12} />
            Live Positions
          </h3>
          <span className="text-[8px] font-bold text-zinc-700">
            {positions.length} Active
          </span>
        </div>

        <div className="space-y-2.5">
          {positions.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 text-center">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                No active positions
              </p>
              <p className="text-[8px] text-zinc-600 mt-1">
                Tap a strike price in the Option Chain to place an order
              </p>
            </div>
          ) : (
            positions.map((pos, i) => {
              const ltp = pos.ltp ?? pos.current_price ?? 0;
              const avg = pos.avgPrice ?? pos.average_price ?? 0;
              const qty = pos.quantity || 0;
              const type = pos.type ?? pos.product ?? 'Unknown';
              const positionPnl = (ltp - avg) * qty;
              const dayPnl = (pos.day_change ?? 0) * qty;
              const isPositionProfit = positionPnl >= 0;
              const isDayProfit = dayPnl >= 0;

              return (
                <div key={pos.symbol} className="relative overflow-hidden rounded-xl group">
                  {user?.role === 'admin' && (
                    <div className="absolute inset-0 bg-zinc-900 flex justify-end items-stretch">
                      <div className="flex h-full">
                        <button
                          onClick={() =>
                            setSlTgtModal({ index: i, symbol: pos.symbol, avgPrice: avg })
                          }
                          className="px-3 bg-blue-600 text-white flex flex-col items-center justify-center gap-1 transition-colors hover:bg-blue-700"
                        >
                          <Target size={12} />
                          <span className="text-[7px] font-black uppercase">SL/Tgt</span>
                        </button>
                        <button
                          onClick={() => setActiveChart(pos)}
                          className="px-3 bg-zinc-800 text-white flex flex-col items-center justify-center gap-1 transition-colors hover:bg-zinc-700"
                        >
                          <BarChart3 size={12} />
                          <span className="text-[7px] font-black uppercase">Chart</span>
                        </button>
                        <button
                          onClick={() => handleExit(i)}
                          className={cn(
                            'px-4 flex flex-col items-center justify-center gap-1 transition-all duration-300',
                            confirmExit === i
                              ? 'bg-rose-500 text-black scale-105'
                              : 'bg-rose-600 text-white hover:bg-rose-700'
                          )}
                        >
                          <XCircle size={14} />
                          <span className="text-[7px] font-black uppercase">
                            {confirmExit === i ? 'Confirm' : 'Exit'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <motion.div
                    drag={user?.role === 'admin' ? 'x' : false}
                    dragConstraints={{ left: -150, right: 0 }}
                    dragElastic={0.1}
                    className={cn(
                      'relative bg-zinc-900/60 border border-zinc-800/50 p-3.5 space-y-2.5 z-10',
                      user?.role === 'admin' ? 'cursor-grab active:cursor-grabbing' : ''
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-black text-white tracking-tight">
                            {pos.symbol}
                          </p>
                          <span
                            className={cn(
                              'px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter',
                              type.toLowerCase() === 'intraday' || type === 'I'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-blue-500/10 text-blue-500'
                            )}
                          >
                            {type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">
                            {qty} Qty
                          </p>
                          <span className="w-1 h-1 rounded-full bg-zinc-800" />
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">
                            Avg {formatCurrency(avg)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 justify-end mb-1.5">
                          <Sparkline
                            color={isPositionProfit ? '#10b981' : '#ef4444'}
                          />
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">
                              Total P&L
                            </p>
                            <p
                              className={cn(
                                'text-sm font-black tracking-tighter leading-none',
                                isPositionProfit
                                  ? 'text-emerald-500'
                                  : 'text-rose-500'
                              )}
                            >
                              {isPositionProfit ? '+' : ''}
                              {formatCurrency(positionPnl)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 justify-end mt-0.5">
                          <div className="text-right">
                            <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">
                              Day P&L
                            </p>
                            <p
                              className={cn(
                                'text-[9px] font-bold leading-none',
                                isDayProfit ? 'text-emerald-500' : 'text-rose-500'
                              )}
                            >
                              {isDayProfit ? '+' : ''}
                              {formatCurrency(dayPnl)}
                            </p>
                          </div>
                          <div className="h-4 w-px bg-zinc-800/80" />
                          <div className="text-right">
                            <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">
                              LTP
                            </p>
                            <p className="text-[9px] font-bold text-white leading-none">
                              {formatCurrency(ltp)}
                              <span
                                className={cn(
                                  'ml-1',
                                  (pos.day_change_pct ?? 0) >= 0
                                    ? 'text-emerald-500'
                                    : 'text-rose-500'
                                )}
                              >
                                ({(pos.day_change_pct ?? 0) >= 0 ? '+' : ''}
                                {(pos.day_change_pct ?? 0).toFixed(2)}%)
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2 border-t border-zinc-800/50 mt-1">
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-rose-500/40" />
                        <span className="text-[8px] font-bold text-zinc-600 uppercase">
                          SL: {formatCurrency(avg * 0.95)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                        <span className="text-[8px] font-bold text-zinc-600 uppercase">
                          Tgt: {formatCurrency(avg * 1.15)}
                        </span>
                      </div>
                    </div>

                    {user?.role === 'user' && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleExit(i)}
                          className={cn(
                            'w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
                            confirmExit === i
                              ? 'bg-rose-500 text-black'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          )}
                        >
                          {confirmExit === i ? 'Confirm Exit' : 'Exit Position'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="px-4 space-y-2.5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <ShieldCheck size={12} />
          Risk Management
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl flex flex-col items-center gap-1 hover:bg-zinc-900/50 transition-all">
            <Target size={16} className="text-blue-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
              Set GTT
            </span>
          </button>
          <button className="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl flex flex-col items-center gap-1 hover:bg-zinc-900/50 transition-all">
            <Layers size={16} className="text-amber-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
              Trailing SL
            </span>
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

        {slTgtModal && (
          <motion.div
            key="sl-tgt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-120 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Set SL & Target
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {slTgtModal.symbol}
                </p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    defaultValue={slTgtModal.avgPrice * 0.95}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-rose-500/50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                    Target
                  </label>
                  <input
                    type="number"
                    defaultValue={slTgtModal.avgPrice * 1.15}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSlTgtModal(null)}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setSlTgtModal(null)}
                  className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                >
                  Update
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {orderConfig && (
          <OrderWindow
            config={orderConfig}
            onClose={() => setOrderConfig(null)}
            onOrderPlaced={() => {
              setOrderConfig(null);
              fetchPositionsData();
              window.dispatchEvent(new CustomEvent('broker_portfolio_updated'));
              setTimeout(() => {
                fetchPositionsData();
                window.dispatchEvent(new CustomEvent('broker_portfolio_updated'));
              }, 1500);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FOTradingCenter;