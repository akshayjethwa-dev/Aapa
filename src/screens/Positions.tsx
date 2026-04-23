import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertCircle, X, BarChart2, ArrowRightLeft, Loader2,
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { apiClient } from '../api/client';

interface Position {
  symbol:            string;
  product:           string;
  quantity:          number;
  avg_price:         number;
  ltp:               number;
  pnl:               number;
  day_pnl:           number;
  broker:            string;
  instrument_token?: string;
  segment?:          string;
}

const productLabel = (p: string) => {
  if (p === 'MIS')  return { label: 'MIS',  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20'  };
  if (p === 'CNC')  return { label: 'CNC',  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20'      };
  if (p === 'NRML') return { label: 'NRML', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20'};
  return { label: p, color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/30' };
};

// ─── Square Off Sheet ─────────────────────────────────────────────────────────
const SquareOffSheet = ({
  position, onClose, onSuccess,
}: { position: Position; onClose: () => void; onSuccess: () => void }) => {
  const [qty, setQty]         = useState(String(position.quantity));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSquareOff = async () => {
    const parsedQty = parseInt(qty, 10);
    if (!parsedQty || parsedQty < 1 || parsedQty > position.quantity) {
      setError(`Quantity must be between 1 and ${position.quantity}`); return;
    }
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/api/positions/squareoff', {
        symbol: position.symbol, product: position.product,
        quantity: parsedQty, instrument_token: position.instrument_token,
      });
      if (res.data.success) { onSuccess(); onClose(); }
      else setError(res.data.message || 'Square off failed.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Network error. Try again.');
    } finally { setLoading(false); }
  };

  const previewPnl = (position.ltp - position.avg_price) * parseInt(qty || '0', 10);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/70"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-full bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 space-y-5"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Square Off</p>
            <h3 className="text-[18px] font-black text-white tracking-tight">{position.symbol}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Product', val: position.product }, { label: 'Avg Price', val: formatCurrency(position.avg_price) }, { label: 'LTP', val: formatCurrency(position.ltp) }].map(r => (
            <div key={r.label} className="bg-zinc-900 rounded-xl p-3 text-center">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{r.label}</p>
              <p className="text-[13px] font-bold text-white mt-0.5">{r.val}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Quantity to Square Off</p>
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <button onClick={() => setQty(q => String(Math.max(1, parseInt(q || '1', 10) - 1)))}
              className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white text-lg font-bold active:scale-95">-</button>
            <input type="number" min={1} max={position.quantity} value={qty}
              onChange={e => setQty(e.target.value)}
              className="flex-1 bg-transparent text-center text-[18px] font-black text-white outline-none" />
            <button onClick={() => setQty(q => String(Math.min(position.quantity, parseInt(q || '0', 10) + 1)))}
              className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white text-lg font-bold active:scale-95">+</button>
          </div>
          <div className="flex justify-between text-[9px] text-zinc-600">
            <span>Max: {position.quantity}</span>
            <button className="text-emerald-500 font-bold" onClick={() => setQty(String(position.quantity))}>Full exit</button>
          </div>
        </div>

        <div className={cn("rounded-xl p-3 flex justify-between items-center",
          previewPnl >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20")}>
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Realised P&L (preview)</p>
          <p className={cn("text-[14px] font-black", previewPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {previewPnl >= 0 ? '+' : ''}{formatCurrency(previewPnl)}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-400">{error}</p>
          </div>
        )}

        <button onClick={handleSquareOff} disabled={loading}
          className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Placing Order…</> : 'Square Off'}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── Convert Sheet ────────────────────────────────────────────────────────────
const ConvertSheet = ({
  position, onClose, onSuccess,
}: { position: Position; onClose: () => void; onSuccess: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const targetProduct = position.product === 'MIS' ? 'CNC' : 'MIS';

  const handleConvert = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/api/positions/convert', {
        symbol: position.symbol, from_product: position.product,
        to_product: targetProduct, quantity: position.quantity,
        instrument_token: position.instrument_token,
      });
      if (res.data.success) { onSuccess(); onClose(); }
      else setError(res.data.message || 'Conversion failed.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Network error. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/70"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-full bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 space-y-5"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Convert Position</p>
            <h3 className="text-[18px] font-black text-white tracking-tight">{position.symbol}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"><X size={16} /></button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 text-center bg-zinc-900 rounded-xl p-4">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">From</p>
            <p className="text-[20px] font-black text-white mt-1">{position.product}</p>
          </div>
          <ArrowRightLeft size={20} className="text-zinc-500 shrink-0" />
          <div className="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest">To</p>
            <p className="text-[20px] font-black text-emerald-400 mt-1">{targetProduct}</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
          {[{ label: 'Symbol', val: position.symbol }, { label: 'Quantity', val: String(position.quantity) }, { label: 'Avg Price', val: formatCurrency(position.avg_price) }].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-[10px] text-zinc-500">{r.label}</span>
              <span className="text-[10px] font-bold text-white">{r.val}</span>
            </div>
          ))}
        </div>

        {targetProduct === 'CNC' && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-400 leading-relaxed">Converting to CNC carries this position overnight. Ensure sufficient margin.</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-400">{error}</p>
          </div>
        )}

        <button onClick={handleConvert} disabled={loading}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Converting…</> : `Convert to ${targetProduct}`}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── Position Row ─────────────────────────────────────────────────────────────
const PositionRow = ({
  position, stocks, onSquareOff, onConvert,
}: { position: Position; stocks: Record<string, number>; onSquareOff: (p: Position) => void; onConvert: (p: Position) => void }) => {
  const ltp   = stocks[position.symbol] || position.ltp;
  const pnl   = (ltp - position.avg_price) * position.quantity;
  const pnlPc = position.avg_price > 0 ? ((ltp - position.avg_price) / position.avg_price) * 100 : 0;
  const { label, color, bg } = productLabel(position.product);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/30 border border-zinc-800/40 rounded-2xl overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 font-black text-[11px]", bg, color)}>
            {label}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-black text-white tracking-tight truncate">{position.symbol}</p>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">
              {position.quantity} Qty · Avg {formatCurrency(position.avg_price)}
              {position.broker && <span className="ml-1 text-zinc-700">· {position.broker}</span>}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[14px] font-black text-white">{formatCurrency(ltp * position.quantity)}</p>
          <p className={cn("text-[10px] font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            <span className="text-[8px] ml-0.5 opacity-70">({pnlPc >= 0 ? '+' : ''}{pnlPc.toFixed(2)}%)</span>
          </p>
          <p className="text-[8px] font-bold text-zinc-600 uppercase mt-0.5">LTP {formatCurrency(ltp)}</p>
        </div>
      </div>
      <div className="flex border-t border-zinc-800/40">
        <button onClick={() => onSquareOff(position)}
          className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors flex items-center justify-center gap-1.5">
          <X size={12} /> Square Off
        </button>
        {(position.product === 'MIS' || position.product === 'CNC') && (
          <>
            <div className="w-px bg-zinc-800/40" />
            <button onClick={() => onConvert(position)}
              className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-sky-400 hover:bg-sky-500/10 active:bg-sky-500/20 transition-colors flex items-center justify-center gap-1.5">
              <ArrowRightLeft size={12} /> Convert
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const Positions = ({ stocks }: { stocks: Record<string, number> }) => {
  const [positions, setPositions]             = useState<Position[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [filter, setFilter]                   = useState<'ALL' | 'MIS' | 'CNC' | 'NRML'>('ALL');
  const [squareOffTarget, setSquareOffTarget] = useState<Position | null>(null);
  const [convertTarget, setConvertTarget]     = useState<Position | null>(null);

  const fetchPositions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get('/api/positions');
      const raw = Array.isArray(res.data) ? res.data : (res.data?.positions || []);
      setPositions(raw);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load positions.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30_000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const displayed = filter === 'ALL' ? positions : positions.filter(p => p.product === filter);

  const totalPnL = positions.reduce((sum, p) => {
    const ltp = stocks[p.symbol] || p.ltp;
    return sum + (ltp - p.avg_price) * p.quantity;
  }, 0);
  const totalDayPnL = positions.reduce((sum, p) => sum + (p.day_pnl || 0), 0);

  const segmentTotals = positions.reduce<Record<string, number>>((acc, p) => {
    const seg = p.segment || (p.product === 'CNC' ? 'EQ' : 'FO');
    const ltp = stocks[p.symbol] || p.ltp;
    acc[seg] = (acc[seg] || 0) + (ltp - p.avg_price) * p.quantity;
    return acc;
  }, {});

  const FILTERS: Array<'ALL' | 'MIS' | 'CNC' | 'NRML'> = ['ALL', 'MIS', 'CNC', 'NRML'];

  return (
    <div className="pb-28 overflow-y-auto scroll-smooth">

      {/* Header */}
      <div className="sticky top-0 bg-black/95 backdrop-blur-md z-10 px-5 pt-4 pb-3 space-y-3 border-b border-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Live</p>
            <h1 className="text-[22px] font-black tracking-tighter text-white">Positions</h1>
          </div>
          <button onClick={fetchPositions} disabled={loading}
            className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap transition-all",
                filter === f
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400")}>
              {f === 'ALL' ? `All (${positions.length})` : `${f} (${positions.filter(p => p.product === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* P&L Summary */}
      {!loading && positions.length > 0 && (
        <div className="px-5 pt-4">
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Unrealised P&L</p>
                <p className={cn("text-[18px] font-black mt-0.5", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Day P&L</p>
                <p className={cn("text-[18px] font-black mt-0.5", totalDayPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {totalDayPnL >= 0 ? '+' : ''}{formatCurrency(totalDayPnL)}
                </p>
              </div>
            </div>
            {Object.keys(segmentTotals).length > 1 && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-zinc-800/40">
                {Object.entries(segmentTotals).map(([seg, val]) => (
                  <div key={seg} className="flex-1">
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{seg}</p>
                    <p className={cn("text-[11px] font-black", val >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {val >= 0 ? '+' : ''}{formatCurrency(val)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-5 pt-4 space-y-3">
        {loading && [1,2,3].map(i => (
          <div key={i} className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-24 bg-zinc-800 rounded" />
                <div className="h-2.5 w-36 bg-zinc-800 rounded" />
              </div>
              <div className="space-y-2 items-end flex flex-col">
                <div className="h-3.5 w-20 bg-zinc-800 rounded" />
                <div className="h-2.5 w-14 bg-zinc-800 rounded" />
              </div>
            </div>
          </div>
        ))}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle size={40} className="text-rose-500/50" />
            <p className="text-zinc-400 text-sm text-center">{error}</p>
            <button onClick={fetchPositions} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-xl text-sm">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && positions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <BarChart2 size={28} className="text-zinc-700" />
            </div>
            <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-widest">No Open Positions</p>
            <p className="text-[10px] text-zinc-700 max-w-55 leading-relaxed">
              Your intraday and F&O trades will appear here once executed.
            </p>
          </div>
        )}

        <AnimatePresence>
          {!loading && !error && displayed.map(pos => (
            <PositionRow key={`${pos.symbol}-${pos.product}`}
              position={pos} stocks={stocks}
              onSquareOff={setSquareOffTarget}
              onConvert={setConvertTarget} />
          ))}
        </AnimatePresence>
      </div>

      {/* Sheets */}
      <AnimatePresence>
        {squareOffTarget && (
          <SquareOffSheet position={squareOffTarget}
            onClose={() => setSquareOffTarget(null)}
            onSuccess={() => { fetchPositions(); window.dispatchEvent(new Event('broker_portfolio_updated')); }} />
        )}
        {convertTarget && (
          <ConvertSheet position={convertTarget}
            onClose={() => setConvertTarget(null)}
            onSuccess={() => { fetchPositions(); window.dispatchEvent(new Event('broker_portfolio_updated')); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Positions;