// src/screens/OrderWindow.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

// ─── OrderConfig — supports both equity and option context ──────────────────
export interface OrderConfig {
  side: 'BUY' | 'SELL';
  /** Index/stock symbol e.g. "NIFTY", "RELIANCE" */
  symbol: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  expiry?: string;
  price: number;
  /**
   * Pre-filled quantity (in lots for F&O, units for equity).
   * When coming from OptionChain quick-trade this = 1 lot size (e.g. 75 for NIFTY).
   */
  defaultQty?: number;
  /**
   * Pre-filled product type.
   * F&O quick-trade sends 'MIS'; equity defaults to 'Intraday'.
   */
  defaultProduct?: 'MIS' | 'NRML' | 'Intraday' | 'Delivery';
}

// ─── Product label mapping ───────────────────────────────────────────────────
// Normalise 'MIS' → 'Intraday', 'NRML' → 'Delivery' for display; reverse on submit
const PRODUCT_DISPLAY: Record<string, string> = {
  MIS: 'Intraday',
  NRML: 'Delivery',
  Intraday: 'Intraday',
  Delivery: 'Delivery',
};
const PRODUCT_API: Record<string, string> = {
  Intraday: 'intraday',
  Delivery: 'delivery',
};

const OrderWindow = ({
  config,
  onClose,
  onOrderPlaced,
  isDemoMode = false,
  onKycRequired,
}: {
  config: OrderConfig;
  onClose: () => void;
  onOrderPlaced: () => void;
  isDemoMode?: boolean;
  onKycRequired?: () => void;
}) => {
  const { user, token } = useAuthStore();

  // ── Determine defaults from config ──────────────────────────────────────
  const isOption = !!config.strike;
  const resolvedDefaultProduct = config.defaultProduct
    ? PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday'
    : isOption
    ? 'Intraday'   // F&O default = MIS (intraday)
    : 'Intraday';

  const [quantity, setQuantity] = useState<number | string>(config.defaultQty ?? 1);
  const [orderType, setOrderType] = useState('Market');
  const [product, setProduct] = useState(resolvedDefaultProduct);
  const [price, setPrice] = useState<number | string>(config.price || 0);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Update quantity if config changes (e.g. user taps a new strike quickly)
  useEffect(() => {
    setQuantity(config.defaultQty ?? 1);
    setPrice(config.price || 0);
    setShowConfirm(false);
    setOrderType('Market');
    const resolved = config.defaultProduct
      ? PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday'
      : isOption
      ? 'Intraday'
      : 'Intraday';
    setProduct(resolved);
  }, [config.symbol, config.strike, config.optionType, config.side]);

  // ── Display symbol ───────────────────────────────────────────────────────
  const displaySymbol = config.strike
    ? `${config.symbol.replace(' 50', '')} ${config.strike} ${config.optionType}`
    : config.symbol.replace(' 50', '');

  // ── Risk math ────────────────────────────────────────────────────────────
  const numQty = Number(quantity) || 0;
  const numPrice = orderType === 'Market' ? config.price : Number(price) || 0;
  const nominalValue = numQty * numPrice;
  const MAX_QTY = config.strike ? 1800 : 10000;
  const NOMINAL_WARNING_THRESHOLD = 500000;
  const isQtyExceeded = numQty > MAX_QTY;
  const isValueHigh = nominalValue > NOMINAL_WARNING_THRESHOLD;

  const handleQtyChange = (val: string) => { setQuantity(val); setShowConfirm(false); };
  const handlePriceChange = (val: string) => { setPrice(val); setShowConfirm(false); };

  // ── Lot multiplier display ────────────────────────────────────────────────
  const LOT_SIZES: Record<string, number> = {
    NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65, MIDCAP: 50, SENSEX: 20,
  };
  const lotSize = isOption ? (LOT_SIZES[config.symbol] ?? 1) : 1;
  const lots = isOption && lotSize > 1 ? Math.round(numQty / lotSize) : null;

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (isValueHigh && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          broker: 'upstox',
          symbol: config.symbol,
          type: config.side.toLowerCase(),
          order_type: orderType.toLowerCase(),
          quantity: numQty,
          price: numPrice,
          product: PRODUCT_API[product] ?? product.toLowerCase(),
          expiry: config.expiry,
          strike: config.strike,
          optionType: config.optionType,
        }),
      });

      const data = await res.json();

      if (res.status === 400 && data.errors && Array.isArray(data.errors)) {
        toast.error(data.errors[0].message);
        setLoading(false);
        return;
      }
      if (res.status === 403 && data.requires_kyc) {
        onClose();
        if (onKycRequired) onKycRequired();
        toast.error(data.message || 'KYC required to trade.');
        return;
      }
      if (res.status === 403 && data.requires_upstox) {
        onClose();
        toast.error(
          <div className="flex flex-col gap-2">
            <span className="font-bold text-rose-500">Action Required</span>
            <span className="text-xs">{data.message}</span>
            <a
              href="https://upstox.com/open-demat-account/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-black uppercase text-center w-full"
            >
              Open Account Now
            </a>
          </div>,
          { duration: 6000 }
        );
        return;
      }
      if (data.success) {
        onOrderPlaced();
        onClose();
        toast.success(`Order placed successfully via Upstox!`);
      } else {
        if (data.code === 'INSUFFICIENT_MARGIN') {
          toast.error(`⚠️ Margin Alert: ${data.message}`);
        } else {
          toast.error(data.message || data.error || 'Order failed');
        }
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-110 bg-black flex flex-col"
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400"
          >
            <ChevronRight className="rotate-180" size={22} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">
              {config.side} {displaySymbol}
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {config.expiry && !isNaN(new Date(config.expiry).getTime())
                ? new Date(config.expiry)
                    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                    .toUpperCase()
                : config.expiry || 'Equity • NSE'}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest',
            config.side === 'BUY'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-rose-500/10 text-rose-500'
          )}
        >
          {config.side}
        </div>
      </div>

      <div className="flex-1 p-5 space-y-7 overflow-y-auto">
        {/* ── Broker status ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
            Executing Broker
          </p>
          {user?.is_uptox_connected ? (
            <div className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 border-emerald-500 text-emerald-500 text-center">
              Upstox Connected
            </div>
          ) : (
            <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                No Broker Connected
              </p>
              <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">
                Connect Upstox in the 'More' tab to trade
              </p>
            </div>
          )}
        </div>

        {/* ── Option context strip ── */}
        {config.strike && (
          <div className="grid grid-cols-3 gap-3 pb-5 border-b border-zinc-900">
            <div className="bg-zinc-900/40 rounded-xl p-3 text-center">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Strike</p>
              <p className="text-sm font-black text-white">{config.strike}</p>
            </div>
            <div
              className={cn(
                'rounded-xl p-3 text-center',
                config.optionType === 'CE'
                  ? 'bg-emerald-500/10'
                  : 'bg-rose-500/10'
              )}
            >
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Type</p>
              <p
                className={cn(
                  'text-sm font-black',
                  config.optionType === 'CE' ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {config.optionType}
              </p>
            </div>
            <div className="bg-zinc-900/40 rounded-xl p-3 text-center">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Expiry</p>
              <p className="text-xs font-black text-white">
                {config.expiry && !isNaN(new Date(config.expiry).getTime())
                  ? new Date(config.expiry)
                      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                      .toUpperCase()
                  : config.expiry || '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Quantity & Price ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                Quantity {lots != null && <span className="text-zinc-500 normal-case">({lots} lot{lots !== 1 ? 's' : ''})</span>}
              </label>
              {isQtyExceeded && (
                <span className="text-[9px] font-bold text-rose-500 uppercase">Max {MAX_QTY}</span>
              )}
            </div>
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleQtyChange(e.target.value)}
              disabled={isDemoMode}
              className={cn(
                'w-full bg-zinc-900/30 border rounded-2xl py-4 px-5 text-sm font-bold focus:outline-none transition-all disabled:opacity-50',
                isQtyExceeded
                  ? 'border-rose-500/50 text-rose-500'
                  : 'border-zinc-800/50 focus:border-emerald-500/50'
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Price
            </label>
            <input
              type="number"
              disabled={orderType === 'Market' || isDemoMode}
              value={orderType === 'Market' ? config.price : price}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-5 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* ── Estimated value ── */}
        <div
          className={cn(
            'p-4 rounded-xl flex justify-between items-center border transition-colors',
            isValueHigh
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-zinc-900/30 border-zinc-800/50'
          )}
        >
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            Est. Order Value
            {isValueHigh && <AlertTriangle size={11} className="text-amber-500" />}
          </span>
          <span className={cn('text-xs font-black', isValueHigh ? 'text-amber-500' : 'text-white')}>
            {formatCurrency(nominalValue)}
          </span>
        </div>

        {/* ── Order Type ── */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
            Order Type
          </p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Market', 'Limit'].map((t) => (
              <button
                key={t}
                onClick={() => { setOrderType(t); setShowConfirm(false); }}
                disabled={isDemoMode}
                className={cn(
                  'flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
                  orderType === t ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500',
                  isDemoMode && 'opacity-50 cursor-not-allowed'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Product ── */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
            Product
            {isOption && (
              <span className="ml-2 text-amber-500/80 normal-case font-semibold text-[9px]">
                (MIS recommended for F&O)
              </span>
            )}
          </p>
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {['Intraday', 'Delivery'].map((p) => (
              <button
                key={p}
                onClick={() => { setProduct(p); setShowConfirm(false); }}
                disabled={isDemoMode}
                className={cn(
                  'flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
                  product === p ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500',
                  isDemoMode && 'opacity-50 cursor-not-allowed'
                )}
              >
                {p === 'Intraday' ? 'MIS (Intraday)' : 'NRML (Delivery)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Place Order button ── */}
      <div className="p-5 bg-black border-t border-zinc-900">
        <button
          onClick={handlePlaceOrder}
          disabled={
            loading ||
            !user?.is_uptox_connected ||
            isDemoMode ||
            isQtyExceeded ||
            numQty <= 0
          }
          className={cn(
            'w-full font-black py-4 rounded-2xl transition-all shadow-xl flex flex-col items-center justify-center gap-1',
            showConfirm
              ? 'bg-amber-500 text-black shadow-amber-500/20'
              : config.side === 'BUY'
              ? 'bg-emerald-500 text-black shadow-emerald-500/10'
              : 'bg-rose-500 text-black shadow-rose-500/10',
            (loading ||
              !user?.is_uptox_connected ||
              isDemoMode ||
              isQtyExceeded ||
              numQty <= 0) &&
              'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? (
            <span className="uppercase text-xs tracking-widest">Processing…</span>
          ) : isDemoMode ? (
            <span className="uppercase text-xs tracking-widest">Disabled in Demo Mode</span>
          ) : showConfirm ? (
            <>
              <span className="uppercase text-xs tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} /> Confirm Large Order
              </span>
              <span className="text-[9px] opacity-80 tracking-widest uppercase">
                Value exceeds ₹5 Lakhs
              </span>
            </>
          ) : (
            <span className="uppercase text-xs tracking-widest">
              {`${config.side} ${displaySymbol}`}
            </span>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default OrderWindow;