// src/screens/OrderWindow.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { wsClient } from '../lib/brokers/websocket';
import { useMarketDataStore } from '../store/marketDataStore';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OrderConfig {
  side: 'BUY' | 'SELL';
  symbol: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  expiry?: string;
  price: number;
  defaultQty?: number;
  defaultProduct?: 'MIS' | 'NRML' | 'Intraday' | 'Delivery';
  // ── Modify-mode extras (injected by Orders.tsx) ──
  _isModify?: boolean;
  _orderId?: string;
  _orderType?: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  _validity?: 'DAY' | 'IOC';
  _triggerPrice?: number;
}

type OrderTypeValue = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
type ValidityValue  = 'DAY' | 'IOC';

// ─── Constants ────────────────────────────────────────────────────────────────
const ORDER_TYPES: { label: string; value: OrderTypeValue; desc: string }[] = [
  { label: 'Market', value: 'MARKET', desc: 'Execute at best available price'      },
  { label: 'Limit',  value: 'LIMIT',  desc: 'Execute at specified price or better' },
  { label: 'SL',     value: 'SL',     desc: 'Limit order triggered at stop price'  },
  { label: 'SL-M',   value: 'SL-M',   desc: 'Market order triggered at stop price' },
];

const VALIDITY_OPTIONS: { label: string; value: ValidityValue; desc: string }[] = [
  { label: 'DAY', value: 'DAY', desc: 'Valid for the entire trading session' },
  { label: 'IOC', value: 'IOC', desc: 'Fill immediately or cancel the rest'  },
];

const PRODUCT_DISPLAY: Record<string, string> = {
  MIS: 'Intraday', NRML: 'Delivery', Intraday: 'Intraday', Delivery: 'Delivery',
};
const PRODUCT_API: Record<string, string> = {
  Intraday: 'intraday', Delivery: 'delivery',
};
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65, MIDCAP: 50, SENSEX: 20,
};

// ─── Component ────────────────────────────────────────────────────────────────
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
  
  // Real-time tick data hook
  const tickData = useMarketDataStore((state) => state.ticks[config.symbol]);
  const livePrice = tickData?.ltp || config.price;

  useEffect(() => {
    if (token && config.symbol) {
      wsClient.connect(token);
      wsClient.subscribe([config.symbol]);
    }
    return () => {
      if (config.symbol) wsClient.unsubscribe([config.symbol]);
    };
  }, [token, config.symbol]);

  const isOption   = !!config.strike;
  const isModify   = !!config._isModify;

  const resolvedDefaultProduct = config.defaultProduct
    ? (PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday')
    : 'Intraday';

  // ── State ──────────────────────────────────────────────────────────────────
  const [quantity,     setQuantity]     = useState<number | string>(config.defaultQty ?? 1);
  const [orderType,    setOrderType]    = useState<OrderTypeValue>(config._orderType ?? 'MARKET');
  const [validity,     setValidity]     = useState<ValidityValue>(config._validity ?? 'DAY');
  const [product,      setProduct]      = useState(resolvedDefaultProduct);
  const [price,        setPrice]        = useState<number | string>(config.price || 0);
  const [triggerPrice, setTriggerPrice] = useState<number | string>(config._triggerPrice ?? '');
  const [loading,      setLoading]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  useEffect(() => {
    setQuantity(config.defaultQty ?? 1);
    setPrice(config.price || 0);
    setTriggerPrice(config._triggerPrice ?? '');
    setShowConfirm(false);
    setOrderType(config._orderType ?? 'MARKET');
    setValidity(config._validity ?? 'DAY');
    setProduct(config.defaultProduct ? (PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday') : 'Intraday');
  }, [config.symbol, config.strike, config.optionType, config.side]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isSLType   = orderType === 'SL' || orderType === 'SL-M';
  const needsPrice = orderType === 'LIMIT' || orderType === 'SL';

  const displaySymbol = config.strike
    ? `${config.symbol.replace(' 50', '')} ${config.strike} ${config.optionType}`
    : config.symbol.replace(' 50', '');

  const numQty       = Number(quantity) || 0;
  const numPrice     = needsPrice ? (Number(price) || 0) : livePrice;
  const nominalValue = numQty * numPrice;
  const lotSize      = isOption ? (LOT_SIZES[config.symbol] ?? 1) : 1;
  const lots         = isOption && lotSize > 1 ? Math.round(numQty / lotSize) : null;
  const MAX_QTY      = config.strike ? 1800 : 10000;
  const isQtyExceeded = numQty > MAX_QTY;
  const isValueHigh   = nominalValue > 500000;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateOrder = (): string | null => {
    if (numQty <= 0)                 return 'Quantity must be greater than 0';
    if (isQtyExceeded)               return `Max quantity is ${MAX_QTY}`;
    if (needsPrice && numPrice <= 0) return 'Enter a valid limit price';
    if (isSLType) {
      const tp = Number(triggerPrice);
      if (!tp || tp <= 0) return 'Enter a valid trigger price';
      if (config.side === 'BUY'  && tp < livePrice) return `Trigger (${tp}) must be ≥ LTP (${livePrice}) for BUY SL`;
      if (config.side === 'SELL' && tp > livePrice) return `Trigger (${tp}) must be ≤ LTP (${livePrice}) for SELL SL`;
      if (orderType === 'SL') {
        if (config.side === 'BUY'  && numPrice < tp) return 'Limit price must be ≥ trigger price for BUY SL';
        if (config.side === 'SELL' && numPrice > tp) return 'Limit price must be ≤ trigger price for SELL SL';
      }
    }
    return null;
  };

  // ── Place / Modify order ───────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const err = validateOrder();
    if (err) { toast.error(err); return; }
    if (isValueHigh && !showConfirm) { setShowConfirm(true); return; }

    setLoading(true);
    try {
      const payload = {
        broker:        'upstox',
        symbol:        config.symbol,
        type:          config.side,
        order_type:    orderType,
        validity:      validity,
        quantity:      numQty,
        price:         needsPrice ? numPrice : 0,
        trigger_price: isSLType ? Number(triggerPrice) : 0,
        product:       PRODUCT_API[product] ?? product.toLowerCase(),
        expiry:        config.expiry,
        strike:        config.strike,
        optionType:    config.optionType,
      };

      // ── MODIFY path: PUT /api/orders/:id ──────────────────────────────────
      if (isModify && config._orderId) {
        const res = await fetch(`/api/orders/${config._orderId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data?.message || data?.error || 'Modify failed');
          setLoading(false);
          return;
        }
        if (data.success) {
          toast.success(`Order modified successfully`);
          onOrderPlaced();
          onClose();
        } else {
          toast.error(data.message || data.error || 'Modify failed');
        }
        return;
      }

      // ── PLACE path: POST /api/orders ──────────────────────────────────────
      const res = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 400 && data.errors && Array.isArray(data.errors)) {
        toast.error(data.errors[0].message); setLoading(false); return;
      }
      if (res.status === 403 && data.requires_kyc) {
        onClose(); if (onKycRequired) onKycRequired();
        toast.error(data.message || 'KYC required to trade.'); return;
      }
      if (res.status === 403 && data.requires_upstox) {
        onClose();
        toast.error(
          <div className="flex flex-col gap-2">
            <span className="font-bold text-rose-500">Action Required</span>
            <span className="text-xs">{data.message}</span>
            <a href="https://upstox.com/open-demat-account/" target="_blank" rel="noopener noreferrer"
              className="mt-2 bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-black uppercase text-center w-full">
              Open Account Now
            </a>
          </div>, { duration: 6000 }
        ); return;
      }
      if (data.success) {
        onOrderPlaced(); onClose();
        toast.success(`${orderType} order placed via Upstox!`);
      } else {
        if (data.code === 'INSUFFICIENT_MARGIN') toast.error(`⚠️ Margin Alert: ${data.message}`);
        else toast.error(data.message || data.error || 'Order failed');
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false); setShowConfirm(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      className="fixed inset-0 z-110 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400">
            <ChevronRight className="rotate-180" size={22} />
          </button>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">
              {isModify ? 'Modify' : config.side} {displaySymbol}
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {isModify
                ? 'Edit your open order'
                : config.expiry && !isNaN(new Date(config.expiry).getTime())
                  ? new Date(config.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
                  : config.expiry || 'Equity • NSE'}
            </p>
          </div>
        </div>
        <div className={cn(
          'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest',
          isModify
            ? 'bg-amber-500/10 text-amber-500'
            : config.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
        )}>
          {isModify ? 'MODIFY' : config.side}
        </div>
      </div>

      <div className="flex-1 p-5 space-y-6 overflow-y-auto">

        {/* Broker status */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Executing Broker</p>
          {user?.is_uptox_connected ? (
            <div className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 border-emerald-500 text-emerald-500 text-center">
              Upstox Connected
            </div>
          ) : (
            <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">No Broker Connected</p>
              <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">Connect Upstox in the 'More' tab to trade</p>
            </div>
          )}
        </div>

        {/* Option context strip */}
        {config.strike && (
          <div className="grid grid-cols-3 gap-3 pb-5 border-b border-zinc-900">
            <div className="bg-zinc-900/40 rounded-xl p-3 text-center">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Strike</p>
              <p className="text-sm font-black text-white">{config.strike}</p>
            </div>
            <div className={cn('rounded-xl p-3 text-center', config.optionType === 'CE' ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Type</p>
              <p className={cn('text-sm font-black', config.optionType === 'CE' ? 'text-emerald-400' : 'text-rose-400')}>
                {config.optionType}
              </p>
            </div>
            <div className="bg-zinc-900/40 rounded-xl p-3 text-center">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">LTP</p>
              <p className="text-sm font-black text-white">{formatCurrency(livePrice)}</p>
            </div>
          </div>
        )}

        {/* Order Type */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Order Type</p>
          <div className="grid grid-cols-4 gap-2">
            {ORDER_TYPES.map(({ label, value }) => (
              <button key={value}
                onClick={() => { setOrderType(value); setShowConfirm(false); }}
                className={cn('py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
                  orderType === value
                    ? isModify
                      ? 'bg-amber-500 text-black'
                      : (config.side === 'BUY' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white')
                    : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800'
                )}>{label}</button>
            ))}
          </div>
          <p className="text-[9px] text-zinc-600 ml-1">{ORDER_TYPES.find(o => o.value === orderType)?.desc}</p>
        </div>

        {/* Validity */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Validity</p>
          <div className="grid grid-cols-2 gap-2">
            {VALIDITY_OPTIONS.map(({ label, value, desc }) => (
              <button key={value}
                onClick={() => { setValidity(value); setShowConfirm(false); }}
                className={cn('py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all text-left px-4',
                  validity === value
                    ? 'bg-zinc-700 text-white border border-zinc-500'
                    : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800 border border-transparent'
                )}>
                <span>{label}</span>
                <p className="text-[8px] font-medium text-zinc-600 normal-case tracking-normal mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Quantity</p>
            {lots !== null && <p className="text-[9px] text-zinc-600">{lots} lot{lots !== 1 ? 's' : ''} × {lotSize}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(q => Math.max(1, Number(q) - (isOption ? lotSize : 1)))}
              className="w-12 h-12 bg-zinc-900 rounded-xl text-white text-xl font-black flex items-center justify-center">−</button>
            <input type="number" inputMode="numeric" value={quantity}
              onChange={e => { setQuantity(e.target.value); setShowConfirm(false); }}
              className="flex-1 h-12 bg-zinc-900 rounded-xl text-center text-white font-black text-base border border-zinc-800 focus:border-zinc-600 outline-none" />
            <button onClick={() => setQuantity(q => Number(q) + (isOption ? lotSize : 1))}
              className="w-12 h-12 bg-zinc-900 rounded-xl text-white text-xl font-black flex items-center justify-center">+</button>
          </div>
          {isQtyExceeded && (
            <div className="flex items-center gap-2 bg-amber-500/10 rounded-xl px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-500 font-bold">Max quantity is {MAX_QTY}</p>
            </div>
          )}
        </div>

        {/* Limit Price */}
        {needsPrice && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Limit Price <span className="text-zinc-700 normal-case tracking-normal font-normal">— LTP: {formatCurrency(livePrice)}</span>
            </p>
            <input type="number" inputMode="decimal" value={price}
              onChange={e => { setPrice(e.target.value); setShowConfirm(false); }}
              placeholder={String(livePrice)}
              className="w-full h-12 bg-zinc-900 rounded-xl px-4 text-white font-bold text-base border border-zinc-800 focus:border-zinc-600 outline-none" />
          </div>
        )}

        {/* Trigger Price */}
        {isSLType && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest ml-1">
              Trigger Price <span className="text-zinc-600 normal-case tracking-normal font-normal">— LTP: {formatCurrency(livePrice)}</span>
            </p>
            <input type="number" inputMode="decimal" value={triggerPrice}
              onChange={e => { setTriggerPrice(e.target.value); setShowConfirm(false); }}
              placeholder={config.side === 'BUY' ? 'Price above LTP to trigger' : 'Price below LTP to trigger'}
              className="w-full h-12 bg-amber-500/5 rounded-xl px-4 text-amber-400 font-bold text-base border border-amber-500/20 focus:border-amber-500/50 outline-none placeholder:text-zinc-700" />
            <p className="text-[9px] text-zinc-600 ml-1">
              {config.side === 'BUY' ? 'Order triggers when market rises to this price' : 'Order triggers when market falls to this price'}
            </p>
          </motion.div>
        )}

        {/* Product */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Product</p>
          <div className="grid grid-cols-2 gap-2">
            {['Intraday', 'Delivery'].map(p => (
              <button key={p} onClick={() => { setProduct(p); setShowConfirm(false); }}
                className={cn('py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
                  product === p ? 'bg-zinc-700 text-white border border-zinc-500' : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800 border border-transparent'
                )}>{p}</button>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-zinc-900/40 rounded-2xl p-4 space-y-2 border border-zinc-900">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Order Summary</p>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500">Type</span>
            <span className="text-white font-bold">{orderType} · {validity}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500">Qty</span>
            <span className="text-white font-bold">{numQty}{lots !== null ? ` (${lots} lot${lots !== 1 ? 's' : ''})` : ''}</span>
          </div>
          {needsPrice && (
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Limit</span>
              <span className="text-white font-bold">{formatCurrency(numPrice)}</span>
            </div>
          )}
          {isSLType && triggerPrice !== '' && (
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-500">Trigger</span>
              <span className="text-amber-400 font-bold">{formatCurrency(Number(triggerPrice))}</span>
            </div>
          )}
          {!needsPrice && (
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Est. Price</span>
              <span className="text-zinc-400 font-bold">Market</span>
            </div>
          )}
          <div className="border-t border-zinc-800 pt-2 flex justify-between text-[11px]">
            <span className="text-zinc-500">Est. Value</span>
            <span className={cn('font-bold', isValueHigh ? 'text-amber-400' : 'text-white')}>
              {formatCurrency(nominalValue)}
            </span>
          </div>
        </div>

        {/* High-value confirmation */}
        {showConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-400">High Value Order</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Estimated value is {formatCurrency(nominalValue)}. Tap again to confirm.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* CTA button */}
      <div className="px-5 pb-8 pt-4 border-t border-zinc-900">
        <button
          onClick={handlePlaceOrder}
          disabled={loading || isQtyExceeded}
          className={cn(
            'w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all',
            loading || isQtyExceeded
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : isModify
              ? 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95'
              : config.side === 'BUY'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black active:scale-95'
              : 'bg-rose-500 hover:bg-rose-400 text-white active:scale-95'
          )}
        >
          {loading
            ? isModify ? 'Modifying Order…' : 'Placing Order…'
            : showConfirm
            ? isModify ? 'Confirm Modify' : `Confirm ${config.side} ${orderType}`
            : isModify ? `Modify Order` : `${config.side} ${displaySymbol}`}
        </button>
      </div>
    </motion.div>
  );
};

export default OrderWindow;