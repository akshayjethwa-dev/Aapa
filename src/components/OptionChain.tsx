// src/components/OptionChain.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  RefreshCw,
  Activity,
  Layers,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import type { NormalizedOptionRow, NormalizedOptionLeg } from '../types/optionChain';

// ─── Lot sizes per symbol (NSE standard) ───────────────────────────────────
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,
  BANKNIFTY: 30,
  FINNIFTY: 65,
  MIDCAP: 50,
  SENSEX: 20,
};

// ─── Props ──────────────────────────────────────────────────────────────────
interface OptionChainProps {
  onPlaceOrder?: (config: import('../types/optionChain').OptionOrderConfig) => void;
  stocks?: Record<string, number | any>;
  fullChain?: boolean;
  initialSymbol?: string;
  lockSymbol?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number | null, dec = 2) =>
  n == null ? '-' : n.toFixed(dec);

const OIBar = ({ value, max, color }: { value: number | null; max: number; color: string }) => {
  if (!value || !max) return null;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-0.5 rounded-full bg-zinc-800/80 mt-0.5">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const OptionChain: React.FC<OptionChainProps> = ({
  onPlaceOrder,
  stocks = {},
  fullChain = false,
  initialSymbol,
  lockSymbol = false,
}) => {
  const normalizeSymbol = (name?: string): string => {
    if (!name) return 'NIFTY';
    const map: Record<string, string> = {
      'NIFTY 50': 'NIFTY',
      NIFTY: 'NIFTY',
      BANKNIFTY: 'BANKNIFTY',
      'NIFTY BANK': 'BANKNIFTY',
      FINNIFTY: 'FINNIFTY',
      'NIFTY FIN SERVICE': 'FINNIFTY',
      MIDCAP: 'MIDCAP',
      'MIDCAP NIFTY': 'MIDCAP',
      SENSEX: 'SENSEX',
    };
    return map[name.toUpperCase()] ?? name.toUpperCase();
  };

  const [symbol, setSymbol] = useState(() => normalizeSymbol(initialSymbol));
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [isExpiriesLoading, setIsExpiriesLoading] = useState(false);
  const [options, setOptions] = useState<NormalizedOptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGreeks, setShowGreeks] = useState(false);

  const { token, user } = useAuthStore();

  const indexMap: Record<string, string> = {
    NIFTY: 'NSE_INDEX|Nifty 50',
    BANKNIFTY: 'NSE_INDEX|Nifty Bank',
    FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
    MIDCAP: 'NSE_INDEX|Nifty Midcap 100',
    SENSEX: 'BSE_INDEX|SENSEX',
  };

  useEffect(() => {
    if (initialSymbol) {
      const normalized = normalizeSymbol(initialSymbol);
      setSymbol(normalized);
      setOptions([]);
      setExpiry('');
    }
  }, [initialSymbol]);

  // ── Spot price ─────────────────────────────────────────────────────────
  const spotPrice = useMemo(() => {
    const keyMap: Record<string, string> = {
      NIFTY: 'NIFTY 50',
      BANKNIFTY: 'BANKNIFTY',
      FINNIFTY: 'FINNIFTY',
      MIDCAP: 'MIDCAP NIFTY',
      SENSEX: 'SENSEX',
    };
    const key = keyMap[symbol] ?? symbol;
    const q = stocks[key];
    return typeof q === 'number' ? q : q?.ltp ?? 0;
  }, [symbol, stocks]);

  // ── ATM strike ─────────────────────────────────────────────────────────
  const atmStrike = useMemo(() => {
    if (!spotPrice || options.length === 0) return null;
    const interval = symbol.includes('BANKNIFTY') ? 100 : symbol === 'SENSEX' ? 100 : 50;
    const rounded = Math.round(spotPrice / interval) * interval;
    const exists = options.find((o) => o.strike === rounded);
    if (exists) return rounded;
    return options.reduce((prev, cur) =>
      Math.abs(cur.strike - spotPrice) < Math.abs(prev.strike - spotPrice) ? cur : prev
    ).strike;
  }, [options, spotPrice, symbol]);

  // ── Max OI for bar width ────────────────────────────────────────────────
  const maxOI = useMemo(() => {
    if (!options.length) return 1;
    return Math.max(
      ...options.flatMap((o) => [o.ce.oi ?? 0, o.pe.oi ?? 0])
    ) || 1;
  }, [options]);

  // ── Fetch expiries ──────────────────────────────────────────────────────
  const fetchExpiries = useCallback(async () => {
    if (!token) return;
    setIsExpiriesLoading(true);
    setError(null);
    try {
      const instrumentKey = indexMap[symbol] || `NSE_INDEX|${symbol}`;
      const response = await apiClient.get(
        `/api/option-expiries?instrument_key=${encodeURIComponent(instrumentKey)}`
      );
      if (response.data.status === 'success' && response.data.data.length > 0) {
        setExpiries(response.data.data);
        setExpiry((prev) => prev || response.data.data[0]);
      } else {
        setError(response.data.error || 'Failed to load expiries');
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Server connection failed while loading expiries.');
    } finally {
      setIsExpiriesLoading(false);
    }
  }, [symbol, token]);

  // ── Fetch option chain ──────────────────────────────────────────────────
  const fetchOptionChain = useCallback(
    async (isSilentRefresh = false) => {
      if (!token || !expiry) return;
      if (!isSilentRefresh || options.length === 0) setLoading(true);
      try {
        const instrumentKey = indexMap[symbol] || `NSE_INDEX|${symbol}`;
        const response = await apiClient.get(
          `/api/option-chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`
        );
        const data = response.data;
        if (data.status === 'success' && data.data) {
          setOptions(data.data as NormalizedOptionRow[]);
          setError(null);
        } else {
          setError(data.error || 'Failed to load option chain data.');
        }
      } catch (e: any) {
        setError(e.response?.data?.error || 'Server connection failed. Could not reach broker.');
      } finally {
        setLoading(false);
      }
    },
    [symbol, expiry, token, options.length]
  );

  useEffect(() => {
    setOptions([]);
    fetchExpiries();
  }, [fetchExpiries]);

  useEffect(() => {
    if (expiry && !error) {
      fetchOptionChain();
      const interval = setInterval(() => fetchOptionChain(true), 5000);
      return () => clearInterval(interval);
    }
  }, [fetchOptionChain, expiry, error]);

  // ── Enrich rows with ITM/ATM flags ─────────────────────────────────────
  const enrichedOptions = useMemo<NormalizedOptionRow[]>(() => {
    return options.map((row) => ({
      ...row,
      isATM: row.strike === atmStrike,
      // CE is ITM when strike < spot (call option in-the-money)
      ceITM: spotPrice > 0 && row.strike < spotPrice,
      // PE is ITM when strike > spot (put option in-the-money)
      peITM: spotPrice > 0 && row.strike > spotPrice,
    }));
  }, [options, atmStrike, spotPrice]);

  // ── Filter to ±5 strikes around ATM for non-admin non-fullChain ─────────
  const filteredOptions = useMemo(() => {
    if (fullChain || (user && user.role === 'admin')) return enrichedOptions;
    if (enrichedOptions.length === 0) return enrichedOptions;
    const atmIdx = enrichedOptions.findIndex((o) => o.strike === atmStrike);
    const center = atmIdx !== -1 ? atmIdx : Math.floor(enrichedOptions.length / 2);
    return enrichedOptions.slice(Math.max(0, center - 5), Math.min(enrichedOptions.length, center + 6));
  }, [enrichedOptions, user, atmStrike, fullChain]);

  // ── Quick trade handler ─────────────────────────────────────────────────
  const handleQuickTrade = (
    side: 'BUY' | 'SELL',
    row: NormalizedOptionRow,
    type: 'CE' | 'PE'
  ) => {
    if (!onPlaceOrder) return;
    const leg: NormalizedOptionLeg = type === 'CE' ? row.ce : row.pe;
    if (!leg.is_active || leg.ltp == null) return;
    const lotSize = LOT_SIZES[symbol] ?? 1;
    onPlaceOrder({
      side,
      symbol,
      strike: row.strike,
      optionType: type,
      expiry,
      price: leg.ltp,
      defaultQty: lotSize,
      defaultProduct: 'MIS',
    });
  };

  const formatExpiryDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase();
  };

  const handleManualRetry = () => {
    setError(null);
    if (expiries.length === 0) fetchExpiries();
    else fetchOptionChain();
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Header Controls ── */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight uppercase">
                Option Chain
              </h2>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                {symbol} · Spot:{' '}
                <span className="text-white">
                  {spotPrice > 0 ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchOptionChain()}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Controls row */}
        <div className={cn('grid gap-2', lockSymbol ? 'grid-cols-2' : 'grid-cols-3')}>
          {!lockSymbol && (
            <div className="relative col-span-1">
              <select
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setOptions([]);
                  setExpiry('');
                }}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all"
              >
                <option value="NIFTY">NIFTY 50</option>
                <option value="BANKNIFTY">BANKNIFTY</option>
                <option value="FINNIFTY">FINNIFTY</option>
                <option value="MIDCAP">MIDCAP NIFTY</option>
                <option value="SENSEX">SENSEX</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            </div>
          )}

          <div className="relative col-span-1">
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={isExpiriesLoading || expiries.length === 0}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
            >
              {isExpiriesLoading ? (
                <option value="">Loading…</option>
              ) : expiries.length > 0 ? (
                expiries.map((d) => (
                  <option key={d} value={d}>{formatExpiryDisplay(d)}</option>
                ))
              ) : (
                <option value="">No Expiries</option>
              )}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowGreeks(!showGreeks)}
            className={cn(
              'col-span-1 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-all border',
              showGreeks
                ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            <Layers size={13} />
            {showGreeks ? 'Hide' : 'Greeks'}
          </button>
        </div>
      </div>

      {/* ── ATM indicator strip ── */}
      {atmStrike && spotPrice > 0 && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-zinc-800/50" />
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
            ATM ≈ {atmStrike.toLocaleString('en-IN')}
          </span>
          <div className="h-px flex-1 bg-zinc-800/50" />
        </div>
      )}

      {/* ── Option Chain Table ── */}
      <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse" style={{ minWidth: 340 }}>
            {/* ── Column headers ── */}
            <thead>
              <tr className="bg-zinc-900/60 border-b border-zinc-800/50">
                <th
                  colSpan={4}
                  className="px-2 py-2 text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest border-r border-zinc-800/50"
                >
                  ← Calls (CE)
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900/80 whitespace-nowrap">
                  Strike
                </th>
                <th
                  colSpan={4}
                  className="px-2 py-2 text-center text-[9px] font-black text-rose-500 uppercase tracking-widest border-l border-zinc-800/50"
                >
                  Puts (PE) →
                </th>
              </tr>
              <tr className="bg-zinc-900/40 border-b border-zinc-800/50 text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                {/* CE side */}
                <th className="px-1.5 py-1 text-center w-10">B/S</th>
                <th className="px-1.5 py-1 text-right">OI/Vol</th>
                <th className="px-1.5 py-1 text-right">%chg</th>
                <th className="px-1.5 py-1 text-right border-r border-zinc-800/50">LTP</th>
                {/* Strike */}
                <th className="px-2 py-1 text-center bg-zinc-900/50">Price</th>
                {/* PE side */}
                <th className="px-1.5 py-1 text-left border-l border-zinc-800/50">LTP</th>
                <th className="px-1.5 py-1 text-left">%chg</th>
                <th className="px-1.5 py-1 text-left">OI/Vol</th>
                <th className="px-1.5 py-1 text-center w-10">B/S</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/20">
              {/* ── Error state ── */}
              {error ? (
                <tr>
                  <td colSpan={9} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center px-4 gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <AlertTriangle size={20} className="text-rose-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-300 mb-1">Option Chain Unavailable</p>
                        <p className="text-[10px] text-zinc-500 max-w-56">{error}</p>
                      </div>
                      <button
                        onClick={handleManualRetry}
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-[11px] transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : loading && options.length === 0 ? (
                // ── Skeleton ──
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-2 py-3">
                        <div className="h-3 bg-zinc-800/50 rounded mx-auto" style={{ width: j === 4 ? 40 : 28 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                // ── Data rows ──
                filteredOptions.map((opt, idx) => {
                  const isATM = opt.isATM;
                  const ceActive = opt.ce.is_active;
                  const peActive = opt.pe.is_active;

                  return (
                    <React.Fragment key={idx}>
                      <tr
                        className={cn(
                          'transition-colors',
                          isATM
                            ? 'bg-amber-500/5 border-y border-amber-500/20'
                            : 'hover:bg-zinc-900/30'
                        )}
                      >
                        {/* ── CE Buy/Sell buttons ── */}
                        <td className="px-1 py-2 text-center">
                          {ceActive ? (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleQuickTrade('BUY', opt, 'CE')}
                                className="px-1.5 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-[8px] font-black rounded uppercase tracking-tight transition-all active:scale-95 leading-none"
                              >
                                B
                              </button>
                              <button
                                onClick={() => handleQuickTrade('SELL', opt, 'CE')}
                                className="px-1.5 py-0.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 text-[8px] font-black rounded uppercase tracking-tight transition-all active:scale-95 leading-none"
                              >
                                S
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── CE OI/Vol ── */}
                        <td className={cn('px-1.5 py-2 text-right', opt.ceITM ? 'bg-emerald-950/20' : '')}>
                          {ceActive ? (
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-zinc-300 leading-none">
                                {opt.ce.oi_formatted}
                              </p>
                              <p className="text-[8px] text-zinc-600 leading-none">
                                {opt.ce.vol_formatted}
                              </p>
                              <OIBar value={opt.ce.oi} max={maxOI} color="bg-emerald-500/60" />
                            </div>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── CE %change ── */}
                        <td className={cn('px-1.5 py-2 text-right', opt.ceITM ? 'bg-emerald-950/20' : '')}>
                          {ceActive && opt.ce.perc_change != null ? (
                            <span
                              className={cn(
                                'text-[9px] font-bold',
                                opt.ce.perc_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              )}
                            >
                              {opt.ce.perc_change >= 0 ? '+' : ''}
                              {opt.ce.perc_change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── CE LTP ── */}
                        <td
                          className={cn(
                            'px-1.5 py-2 text-right border-r border-zinc-800/40',
                            opt.ceITM ? 'bg-emerald-950/20' : ''
                          )}
                        >
                          {ceActive && opt.ce.ltp != null ? (
                            <span className="text-[11px] font-black text-white">
                              {opt.ce.ltp.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── Strike (center) ── */}
                        <td className="px-2 py-2 text-center bg-zinc-900/50">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={cn(
                                'text-[11px] font-black',
                                isATM ? 'text-amber-400' : 'text-zinc-300'
                              )}
                            >
                              {opt.strike.toLocaleString('en-IN')}
                            </span>
                            {isATM && (
                              <span className="text-[7px] font-black text-amber-500/80 uppercase tracking-wider leading-none">
                                ATM
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ── PE LTP ── */}
                        <td
                          className={cn(
                            'px-1.5 py-2 text-left border-l border-zinc-800/40',
                            opt.peITM ? 'bg-rose-950/20' : ''
                          )}
                        >
                          {peActive && opt.pe.ltp != null ? (
                            <span className="text-[11px] font-black text-white">
                              {opt.pe.ltp.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── PE %change ── */}
                        <td className={cn('px-1.5 py-2 text-left', opt.peITM ? 'bg-rose-950/20' : '')}>
                          {peActive && opt.pe.perc_change != null ? (
                            <span
                              className={cn(
                                'text-[9px] font-bold',
                                opt.pe.perc_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              )}
                            >
                              {opt.pe.perc_change >= 0 ? '+' : ''}
                              {opt.pe.perc_change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── PE OI/Vol ── */}
                        <td className={cn('px-1.5 py-2 text-left', opt.peITM ? 'bg-rose-950/20' : '')}>
                          {peActive ? (
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-zinc-300 leading-none">
                                {opt.pe.oi_formatted}
                              </p>
                              <p className="text-[8px] text-zinc-600 leading-none">
                                {opt.pe.vol_formatted}
                              </p>
                              <OIBar value={opt.pe.oi} max={maxOI} color="bg-rose-500/60" />
                            </div>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>

                        {/* ── PE Buy/Sell buttons ── */}
                        <td className="px-1 py-2 text-center">
                          {peActive ? (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleQuickTrade('BUY', opt, 'PE')}
                                className="px-1.5 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-[8px] font-black rounded uppercase tracking-tight transition-all active:scale-95 leading-none"
                              >
                                B
                              </button>
                              <button
                                onClick={() => handleQuickTrade('SELL', opt, 'PE')}
                                className="px-1.5 py-0.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 text-[8px] font-black rounded uppercase tracking-tight transition-all active:scale-95 leading-none"
                              >
                                S
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-700 text-[9px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Greeks row ── */}
                      {showGreeks && (
                        <tr className="bg-zinc-900/30 text-[8px] border-b border-zinc-800/20">
                          <td colSpan={4} className="px-2 py-1.5 border-r border-zinc-800/40">
                            {opt.ce.is_active && (
                              <div className="flex items-center justify-around">
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">IV</span>
                                  <span className="text-purple-400 font-bold">{opt.ce.iv}%</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">Δ</span>
                                  <span className="text-zinc-300 font-bold">{opt.ce.delta}</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">θ</span>
                                  <span className="text-zinc-300 font-bold">{opt.ce.theta}</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">V</span>
                                  <span className="text-zinc-300 font-bold">{opt.ce.vega}</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="bg-zinc-900/60" />
                          <td colSpan={4} className="px-2 py-1.5 border-l border-zinc-800/40">
                            {opt.pe.is_active && (
                              <div className="flex items-center justify-around">
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">IV</span>
                                  <span className="text-purple-400 font-bold">{opt.pe.iv}%</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">Δ</span>
                                  <span className="text-zinc-300 font-bold">{opt.pe.delta}</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">θ</span>
                                  <span className="text-zinc-300 font-bold">{opt.pe.theta}</span>
                                </span>
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-[7px] uppercase tracking-wide text-zinc-600">V</span>
                                  <span className="text-zinc-300 font-bold">{opt.pe.vega}</span>
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Legend ── */}
        {!error && !loading && filteredOptions.length > 0 && (
          <div className="px-3 py-2 border-t border-zinc-800/30 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-sm bg-emerald-950/60 border border-emerald-800/40" />
              CE ITM
            </span>
            <span className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-sm bg-rose-950/60 border border-rose-800/40" />
              PE ITM
            </span>
            <span className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-sm bg-amber-500/10 border border-amber-500/30" />
              ATM
            </span>
            <span className="ml-auto text-[8px] font-bold text-zinc-700 uppercase tracking-wider">
              B = Buy · S = Sell · auto-fills 1 lot MIS
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionChain;