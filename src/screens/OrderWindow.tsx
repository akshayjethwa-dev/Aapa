// src/screens/OrderWindow.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
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
  
  // --- NEW: Polling State ---
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

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

  // --- NEW: Polling Mechanism ---
  const startOrderPolling = (orderId: string) => {
    setPollStatus('PENDING');
    
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        // Ping your backend, which in turn calls Upstox Order Details
        const res = await fetch(`/api/orders/${orderId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status) {
          const statusUpper = data.status.toUpperCase();
          setPollStatus(statusUpper);

          // Terminal States
          if (data.is_terminal || ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(statusUpper)) {
            clearInterval(pollIntervalRef.current as NodeJS.Timeout);
            setLoading(false);

            if (statusUpper === 'COMPLETED') {
              toast.success(
                <div className="flex flex-col gap-1">
                  <span className="font-bold">Order Executed</span>
                  <span className="text-xs">Filled at {formatCurrency(data.average_price || 0)}</span>
                </div>
              );
              onOrderPlaced();
              dismiss();
            } else if (statusUpper === 'REJECTED') {
              toast.error(
                <div className="flex flex-col gap-1">
                  <span className="font-bold">Order Rejected</span>
                  <span className="text-xs">{data.status_message || 'Margin Shortfall'}</span>
                </div>
              );
              setPollStatus(null); // Reset so user can try editing/resubmitting
            } else {
              toast.info(`Order ${statusUpper}`);
              setPollStatus(null);
            }
          }
        }
      } catch (err) {
        console.error("Polling network error, retrying next tick...", err);
      }
    }, 2000);
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
          setLoading(false);
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
        setLoading(false);
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
        setLoading(false);
        return;
      }

      if (data.success) {
        // NEW: If backend returns order_id, initiate polling. 
        // Otherwise, fall back to immediate dismiss.
        if (data.order_id) {
          startOrderPolling(data.order_id);
          toast.info('Order submitted, awaiting exchange execution...');
        } else {
          onOrderPlaced();
          dismiss();
          toast.success(
            isBracket
              ? 'Bracket order placed via Upstox!'
              : `${orderType} order placed via Upstox!`
          );
        }
      } else {
        if (data.code === 'INSUFFICIENT_MARGIN') {
          toast.error(`⚠️ Margin Alert: ${data.message}`);
        } else {
          toast.error(data.message || data.error || 'Order failed');
        }
        setLoading(false);
      }
    } catch {
      toast.error('Network error. Please check your connection.');
      setLoading(false);
    } finally {
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-110 flex flex-col justify-end" style={{ isolation: 'isolate' }}>
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!loading ? dismiss : undefined}
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
          onPointerDown={!loading ? onPointerDown : undefined}
          onPointerMove={!loading ? onPointerMove : undefined}
          onPointerUp={!loading ? onPointerUp : undefined}
          role="button"
          aria-label="Drag to dismiss order window"
        >
          <div className="w-10 h-1 rounded-full bg-zinc-700 mb-3" />
        </div>

        <div className="px-5 pb-4 border-b border-zinc-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              disabled={loading}
              className={cn(
                "p-2 rounded-xl transition-colors",
                loading ? "opacity-50 cursor-not-allowed text-zinc-600" : "hover:bg-zinc-900 text-zinc-400 active:bg-zinc-800"
              )}
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
          {/* ... (Skipped middle UI portions for brevity - keep your existing UI inputs identical) ... */}
          {/* Keep all your strike, order type, product, quantity, pricing, and summary blocks exactly as they were */}
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

          {/* ... Rest of inputs (Order Type, Bracket Toggle, Quantities, Prices, Order Summary) remain identical ... */}
          <div className="space-y-2">
             <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Order Type</p>
             {/* Replace this comment block with your exact existing grid mapping for ORDER_TYPES */}
          </div>

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
              'w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all active:scale-95',
              loading || isQtyExceeded
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : isModify
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : config.side === 'BUY'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-rose-500 hover:bg-rose-400 text-white'
            )}
          >
            {loading && <Loader2 size={16} className="animate-spin shrink-0" />}
            {loading
              ? pollStatus
                ? `ORDER ${pollStatus}...` // E.g., "ORDER PENDING..."
                : isModify
                ? 'MODIFYING ORDER…'
                : 'PLACING ORDER…'
              : showConfirm
              ? isModify
                ? 'CONFIRM MODIFY'
                : `CONFIRM ${config.side} ${isBracket ? 'BRACKET' : orderType}`
              : isModify
              ? 'MODIFY ORDER'
              : `${config.side} ${displaySymbol}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderWindow;