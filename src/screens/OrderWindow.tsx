// src/screens/OrderWindow.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { wsClient } from '../lib/brokers/websocket';
import { useMarketDataStore } from '../store/marketDataStore';

export interface OrderConfig {
  side: 'BUY' | 'SELL';
  symbol: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  expiry?: string;
  price?: number;
  defaultQty?: number;
  defaultProduct?: 'MIS' | 'NRML' | 'Intraday' | 'Delivery';
  _isModify?: boolean;
  _orderId?: string;
  _orderType?: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  _validity?: 'DAY' | 'IOC';
  _triggerPrice?: number;
}

type OrderTypeValue = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
type ValidityValue = 'DAY' | 'IOC';

const ORDER_TYPES: { label: string; value: OrderTypeValue; desc: string }[] = [
  { label: 'Market', value: 'MARKET', desc: 'Execute at best available price' },
  { label: 'Limit', value: 'LIMIT', desc: 'Execute at specified price or better' },
  { label: 'SL', value: 'SL', desc: 'Limit order triggered at stop price' },
  { label: 'SL-M', value: 'SL-M', desc: 'Market order triggered at stop price' },
];

const VALIDITY_OPTIONS: { label: string; value: ValidityValue; desc: string }[] = [
  { label: 'DAY', value: 'DAY', desc: 'Valid for the entire trading session' },
  { label: 'IOC', value: 'IOC', desc: 'Fill immediately or cancel the rest' },
];

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

const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,
  BANKNIFTY: 30,
  FINNIFTY: 65,
  MIDCAP: 50,
  SENSEX: 20,
};

const DISMISS_RATIO = 0.35;

function ensureOrderWindowAnimations() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('order-window-keyframes')) return;

  const style = document.createElement('style');
  style.id = 'order-window-keyframes';
  style.textContent = `
    @keyframes ow-fade-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes ow-scale-in {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes ow-expand {
      from { opacity: 0; max-height: 0; }
      to { opacity: 1; max-height: 220px; }
    }

    .ow-fade-in {
      animation: ow-fade-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .ow-scale-in {
      animation: ow-scale-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .ow-expand {
      animation: ow-expand 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
}

function useBottomSheet(onDismiss: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const dragStartY = useRef(0);
  const currentDragY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;

    sheet.style.transform = 'translateY(100%)';
    backdrop.style.opacity = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sheet.style.transition = 'transform 380ms cubic-bezier(0.32, 0.72, 0, 1)';
        backdrop.style.transition = 'opacity 320ms ease';
        sheet.style.transform = 'translateY(0)';
        backdrop.style.opacity = '1';
      });
    });
  }, []);

  const dismiss = useCallback(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (!sheet || !backdrop) {
      onDismiss();
      return;
    }

    sheet.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
    backdrop.style.transition = 'opacity 260ms ease';
    sheet.style.transform = 'translateY(110%)';
    backdrop.style.opacity = '0';

    sheet.addEventListener('transitionend', onDismiss, { once: true });
  }, [onDismiss]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    currentDragY.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;

    const dy = e.clientY - dragStartY.current;
    if (dy < 0) return;

    currentDragY.current = dy;

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;

    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${dy}px)`;

    if (backdrop) {
      const ratio = Math.min(dy / (sheet.offsetHeight * DISMISS_RATIO * 2), 1);
      backdrop.style.opacity = String(1 - ratio);
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;

    const threshold = sheet.offsetHeight * DISMISS_RATIO;

    if (currentDragY.current > threshold) {
      dismiss();
    } else {
      sheet.style.transition = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = 'translateY(0)';

      if (backdrop) {
        backdrop.style.transition = 'opacity 260ms ease';
        backdrop.style.opacity = '1';
      }
    }
  }, [dismiss]);

  return {
    sheetRef,
    backdropRef,
    dismiss,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

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

  useEffect(() => {
    ensureOrderWindowAnimations();
  }, []);

  const tickData = useMarketDataStore((state) => state.ticks[config.symbol]);
  const livePrice = tickData?.ltp || config.price || 0;

  useEffect(() => {
    if (token && config.symbol) {
      wsClient.connect(token);
      wsClient.subscribe([config.symbol]);
    }

    return () => {
      if (config.symbol) wsClient.unsubscribe([config.symbol]);
    };
  }, [token, config.symbol]);

  const isOption = !!config.strike;
  const isModify = !!config._isModify;

  const resolvedDefaultProduct = config.defaultProduct
    ? PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday'
    : 'Intraday';

  const [quantity, setQuantity] = useState<number | string>(config.defaultQty ?? 1);
  const [orderType, setOrderType] = useState<OrderTypeValue>(config._orderType ?? 'MARKET');
  const [validity, setValidity] = useState<ValidityValue>(config._validity ?? 'DAY');
  const [product, setProduct] = useState(resolvedDefaultProduct);
  const [price, setPrice] = useState<number | string>(config.price || livePrice);
  const [triggerPrice, setTriggerPrice] = useState<number | string>(config._triggerPrice ?? '');

  const [isBracket, setIsBracket] = useState(false);
  const [targetSpread, setTargetSpread] = useState<number | string>('');
  const [stoplossSpread, setStoplossSpread] = useState<number | string>('');

  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setQuantity(config.defaultQty ?? 1);
    setPrice(config.price || livePrice);
    setTriggerPrice(config._triggerPrice ?? '');
    setShowConfirm(false);
    setOrderType(config._orderType ?? 'MARKET');
    setValidity(config._validity ?? 'DAY');
    setProduct(config.defaultProduct ? PRODUCT_DISPLAY[config.defaultProduct] ?? 'Intraday' : 'Intraday');
    setIsBracket(false);
    setTargetSpread('');
    setStoplossSpread('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.symbol, config.strike, config.optionType, config.side]);

  const isSLType = orderType === 'SL' || orderType === 'SL-M';
  const needsPrice = orderType === 'LIMIT' || orderType === 'SL';

  const displaySymbol = config.strike
    ? `${config.symbol.replace(' 50', '')} ${config.strike} ${config.optionType}`
    : config.symbol.replace(' 50', '');

  const numQty = Number(quantity) || 0;
  const numPrice = needsPrice ? Number(price) || 0 : livePrice;
  const nominalValue = numQty * numPrice;

  const lotSize = isOption ? LOT_SIZES[config.symbol] ?? 1 : 1;
  const lots = isOption && lotSize > 1 ? Math.round(numQty / lotSize) : null;
  const MAX_QTY = config.strike ? 1800 : 10000;
  const isQtyExceeded = numQty > MAX_QTY;
  const isValueHigh = nominalValue > 500000;

  const { sheetRef, backdropRef, dismiss, onPointerDown, onPointerMove, onPointerUp } =
    useBottomSheet(onClose);

  const validateOrder = (): string | null => {
    if (numQty <= 0) return 'Quantity must be greater than 0';
    if (isQtyExceeded) return `Max quantity is ${MAX_QTY}`;
    if (needsPrice && numPrice <= 0) return 'Enter a valid limit price';

    if (isBracket) {
      if (!targetSpread || Number(targetSpread) <= 0) {
        return 'Enter a valid target spread for Bracket Order';
      }
      if (!stoplossSpread || Number(stoplossSpread) <= 0) {
        return 'Enter a valid stop loss spread for Bracket Order';
      }
      if (orderType !== 'LIMIT') {
        return 'Bracket orders require a LIMIT order type.';
      }
    }

    if (isSLType) {
      const tp = Number(triggerPrice);
      if (!tp || tp <= 0) return 'Enter a valid trigger price';

      if (config.side === 'BUY' && tp < livePrice) {
        return `Trigger (${tp}) must be ≥ LTP (${livePrice}) for BUY SL`;
      }
      if (config.side === 'SELL' && tp > livePrice) {
        return `Trigger (${tp}) must be ≤ LTP (${livePrice}) for SELL SL`;
      }

      if (orderType === 'SL') {
        if (config.side === 'BUY' && numPrice < tp) {
          return 'Limit price must be ≥ trigger price for BUY SL';
        }
        if (config.side === 'SELL' && numPrice > tp) {
          return 'Limit price must be ≤ trigger price for SELL SL';
        }
      }
    }

    return null;
  };

  const handlePlaceOrder = async () => {
    const err = validateOrder();
    if (err) {
      toast.error(err);
      return;
    }

    if (isValueHigh && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        broker: 'upstox',
        symbol: config.symbol,
        type: config.side,
        order_type: orderType,
        validity,
        quantity: numQty,
        price: needsPrice ? numPrice : 0,
        trigger_price: isSLType ? Number(triggerPrice) : 0,
        product: PRODUCT_API[product] ?? product.toLowerCase(),
        expiry: config.expiry,
        strike: config.strike,
        optionType: config.optionType,
        is_bracket: isBracket,
        target_price: isBracket ? Number(targetSpread) : undefined,
        stoploss_price: isBracket ? Number(stoplossSpread) : undefined,
      };

      if (isModify && config._orderId) {
        const res = await fetch(`/api/orders/${config._orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data?.message || data?.error || 'Modify failed');
          setLoading(false);
          return;
        }

        if (data.success) {
          toast.success('Order modified successfully');
          onOrderPlaced();
          dismiss();
        } else {
          toast.error(data.message || data.error || 'Modify failed');
        }

        return;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 400 && data.errors && Array.isArray(data.errors)) {
        toast.error(data.errors[0].message);
        setLoading(false);
        return;
      }

      if (res.status === 403 && data.requires_kyc) {
        dismiss();
        if (onKycRequired) onKycRequired();
        toast.error(data.message || 'KYC required to trade.');
        return;
      }

      if (res.status === 403 && data.requires_upstox) {
        dismiss();
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
        dismiss();
        toast.success(
          isBracket
            ? 'Bracket order placed via Upstox!'
            : `${orderType} order placed via Upstox!`
        );
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
    <div className="fixed inset-0 z-110 flex flex-col justify-end" style={{ isolation: 'isolate' }}>
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
        style={{ willChange: 'opacity' }}
      />

      <div
        ref={sheetRef}
        className="relative w-full bg-black rounded-t-3xl flex flex-col max-h-[92dvh] overflow-hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          willChange: 'transform',
        }}
      >
        <div
          className="flex flex-col items-center pt-3 pb-0 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="button"
          aria-label="Drag to dismiss order window"
        >
          <div className="w-10 h-1 rounded-full bg-zinc-700 mb-3" />
        </div>

        <div className="px-5 pb-4 border-b border-zinc-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 active:bg-zinc-800 transition-colors"
              aria-label="Close order window"
            >
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
              isModify
                ? 'bg-amber-500/10 text-amber-500'
                : config.side === 'BUY'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-rose-500/10 text-rose-500'
            )}
          >
            {isModify ? 'MODIFY' : config.side}
          </div>
        </div>

        <div className="flex-1 p-5 space-y-6 overflow-y-auto overscroll-contain">
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

          {config.strike && (
            <div className="grid grid-cols-3 gap-3 pb-5 border-b border-zinc-900">
              <div className="bg-zinc-900/40 rounded-xl p-3 text-center">
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                  Strike
                </p>
                <p className="text-sm font-black text-white">{config.strike}</p>
              </div>

              <div
                className={cn(
                  'rounded-xl p-3 text-center',
                  config.optionType === 'CE' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                )}
              >
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                  Type
                </p>
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
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                  LTP
                </p>
                <p className="text-sm font-black text-white transition-colors duration-200">
                  {formatCurrency(livePrice)}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Order Type
            </p>

            <div className="grid grid-cols-4 gap-2">
              {ORDER_TYPES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => {
                    setOrderType(value);
                    if (isBracket && value !== 'LIMIT') setIsBracket(false);
                    setShowConfirm(false);
                  }}
                  className={cn(
                    'py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors active:scale-95',
                    orderType === value
                      ? isModify
                        ? 'bg-amber-500 text-black'
                        : config.side === 'BUY'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-rose-500 text-white'
                      : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[9px] text-zinc-600 ml-1">
              {ORDER_TYPES.find((o) => o.value === orderType)?.desc}
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-zinc-900">
            <div className="flex items-center justify-between ml-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  Bracket Order (OCO)
                </p>
                <div className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase">
                  Beta
                </div>
              </div>

              <button
                onClick={() => {
                  setIsBracket(!isBracket);
                  if (!isBracket && orderType !== 'LIMIT') setOrderType('LIMIT');
                  if (!isBracket && product === 'Delivery') setProduct('Intraday');
                  setShowConfirm(false);
                }}
                className={cn(
                  'w-10 h-5 rounded-full relative transition-colors',
                  isBracket ? 'bg-amber-500' : 'bg-zinc-800'
                )}
                role="switch"
                aria-checked={isBracket}
                aria-label="Toggle bracket order"
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all',
                    isBracket ? 'left-5' : 'left-1'
                  )}
                />
              </button>
            </div>

            {isBracket && (
              <div className="ow-expand grid grid-cols-2 gap-3">
                <div className="space-y-2 mt-1">
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                    Target Spread
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetSpread}
                    onChange={(e) => {
                      setTargetSpread(e.target.value);
                      setShowConfirm(false);
                    }}
                    placeholder="e.g., 10 pts"
                    className="w-full h-11 bg-emerald-500/5 rounded-xl px-4 text-emerald-400 font-bold text-sm border border-emerald-500/20 focus:border-emerald-500/50 outline-none placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 mt-1">
                  <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">
                    Stop Loss Spread
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={stoplossSpread}
                    onChange={(e) => {
                      setStoplossSpread(e.target.value);
                      setShowConfirm(false);
                    }}
                    placeholder="e.g., 5 pts"
                    className="w-full h-11 bg-rose-500/5 rounded-xl px-4 text-rose-400 font-bold text-sm border border-rose-500/20 focus:border-rose-500/50 outline-none placeholder:text-zinc-700"
                  />
                </div>
              </div>
            )}

            {isBracket && (
              <p className="text-[9px] text-zinc-500 ml-1">
                Spreads are absolute points (e.g. entry at 100 with target spread 10 places target at 110).
              </p>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-900">
            <div className="flex items-center justify-between ml-1">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                Quantity
              </p>
              {lots !== null && (
                <p className="text-[9px] text-zinc-600">
                  {lots} lot{lots !== 1 ? 's' : ''} × {lotSize}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setQuantity((q) => Math.max(1, Number(q) - (isOption ? lotSize : 1)))
                }
                className="w-12 h-12 bg-zinc-900 rounded-xl text-white text-xl font-black flex items-center justify-center active:bg-zinc-700 transition-colors"
                aria-label="Decrease quantity"
              >
                −
              </button>

              <input
                type="number"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setShowConfirm(false);
                }}
                className="flex-1 h-12 bg-zinc-900 rounded-xl text-center text-white font-black text-base border border-zinc-800 focus:border-zinc-600 outline-none"
              />

              <button
                onClick={() => setQuantity((q) => Number(q) + (isOption ? lotSize : 1))}
                className="w-12 h-12 bg-zinc-900 rounded-xl text-white text-xl font-black flex items-center justify-center active:bg-zinc-700 transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {isQtyExceeded && (
              <div className="flex items-center gap-2 bg-amber-500/10 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                <p className="text-[10px] text-amber-500 font-bold">Max quantity is {MAX_QTY}</p>
              </div>
            )}
          </div>

          {needsPrice && (
            <div className="space-y-2 ow-fade-in">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                Limit Price{' '}
                <span className="text-zinc-700 normal-case tracking-normal font-normal">
                  — LTP: <span className="text-white">{formatCurrency(livePrice)}</span>
                </span>
              </p>

              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setShowConfirm(false);
                }}
                placeholder={String(livePrice)}
                className="w-full h-12 bg-zinc-900 rounded-xl px-4 text-white font-bold text-base border border-zinc-800 focus:border-zinc-600 outline-none"
              />
            </div>
          )}

          {isSLType && (
            <div className="space-y-2 ow-fade-in">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest ml-1">
                Trigger Price{' '}
                <span className="text-zinc-600 normal-case tracking-normal font-normal">
                  — LTP: <span className="text-zinc-400">{formatCurrency(livePrice)}</span>
                </span>
              </p>

              <input
                type="number"
                inputMode="decimal"
                value={triggerPrice}
                onChange={(e) => {
                  setTriggerPrice(e.target.value);
                  setShowConfirm(false);
                }}
                placeholder={
                  config.side === 'BUY'
                    ? 'Price above LTP to trigger'
                    : 'Price below LTP to trigger'
                }
                className="w-full h-12 bg-amber-500/5 rounded-xl px-4 text-amber-400 font-bold text-base border border-amber-500/20 focus:border-amber-500/50 outline-none placeholder:text-zinc-700"
              />

              <p className="text-[9px] text-zinc-600 ml-1">
                {config.side === 'BUY'
                  ? 'Order triggers when market rises to this price'
                  : 'Order triggers when market falls to this price'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Product
            </p>

            <div className="grid grid-cols-2 gap-2">
              {['Intraday', 'Delivery'].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    if (!isBracket) setProduct(p);
                    setShowConfirm(false);
                  }}
                  className={cn(
                    'py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors active:scale-95',
                    isBracket && p === 'Delivery'
                      ? 'opacity-50 cursor-not-allowed bg-zinc-900/60 text-zinc-600'
                      : product === p
                      ? 'bg-zinc-700 text-white border border-zinc-500'
                      : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800 border border-transparent'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {orderType !== 'MARKET' && (
            <div className="space-y-2 ow-fade-in">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                Validity
              </p>

              <div className="grid grid-cols-2 gap-2">
                {VALIDITY_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setValidity(value)}
                    className={cn(
                      'py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors',
                      validity === value
                        ? 'bg-zinc-700 text-white border border-zinc-500'
                        : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800 border border-transparent'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-[9px] text-zinc-600 ml-1">
                {VALIDITY_OPTIONS.find((o) => o.value === validity)?.desc}
              </p>
            </div>
          )}

          <div className="bg-zinc-900/40 rounded-2xl p-4 space-y-2 border border-zinc-900">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
              Order Summary
            </p>

            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Type</span>
              <span className="text-white font-bold">
                {isBracket ? 'BRACKET OCO' : orderType} · {validity}
              </span>
            </div>

            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Qty</span>
              <span className="text-white font-bold">
                {numQty}
                {lots !== null ? ` (${lots} lot${lots !== 1 ? 's' : ''})` : ''}
              </span>
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
                <span className="text-amber-400 font-bold">
                  {formatCurrency(Number(triggerPrice))}
                </span>
              </div>
            )}

            {!needsPrice && (
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Est. Price</span>
                <span className="text-zinc-400 font-bold">
                  Market (LTP: {formatCurrency(livePrice)})
                </span>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-2 flex justify-between text-[11px]">
              <span className="text-zinc-500">Est. Value</span>
              <span
                className={cn(
                  'font-bold transition-colors duration-200',
                  isValueHigh ? 'text-amber-400' : 'text-white'
                )}
              >
                {formatCurrency(nominalValue)}
              </span>
            </div>
          </div>

          {showConfirm && (
            <div className="ow-scale-in flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400">High Value Order</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Estimated value is {formatCurrency(nominalValue)}. Tap again to confirm.
                </p>
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>

        <div className="px-5 pt-4 border-t border-zinc-900 bg-black">
          <button
            onClick={handlePlaceOrder}
            disabled={loading || isQtyExceeded}
            className={cn(
              'w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95',
              loading || isQtyExceeded
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : isModify
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : config.side === 'BUY'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-rose-500 hover:bg-rose-400 text-white'
            )}
          >
            {loading
              ? isModify
                ? 'Modifying Order…'
                : 'Placing Order…'
              : showConfirm
              ? isModify
                ? 'Confirm Modify'
                : `Confirm ${config.side} ${isBracket ? 'Bracket' : orderType}`
              : isModify
              ? 'Modify Order'
              : `${config.side} ${displaySymbol}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderWindow;