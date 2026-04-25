// src/components/WatchlistManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable hook + component set for multi-watchlist management.
// Used by Market.tsx to provide: tab switcher, CRUD dialogs, drag-to-reorder.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Check, Search, GripVertical, Star
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { wsClient } from '../lib/brokers/websocket';
import { useMarketDataStore } from '../store/marketDataStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  symbol: string;
  sort_order: number;
  added_at: string;
}

export interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  items: WatchlistItem[];
}

// ─── Custom hook: useWatchlists ───────────────────────────────────────────────
// All API interaction lives here; components only call the exposed actions.

export function useWatchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWatchlist = watchlists.find(w => w.id === activeId) ?? null;

  // ── Fetch all ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Watchlist[]>('/api/watchlists');
      const data = res.data ?? [];
      setWatchlists(data);
      if (data.length > 0 && !activeId) {
        setActiveId(data[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  // ── Create ──
  const createWatchlist = useCallback(async (name: string) => {
    const res = await apiClient.post<Watchlist>('/api/watchlists', { name });
    setWatchlists(prev => [...prev, res.data]);
    setActiveId(res.data.id);
    return res.data;
  }, []);

  // ── Rename ──
  const renameWatchlist = useCallback(async (id: string, name: string) => {
    const res = await apiClient.put<Watchlist>(`/api/watchlists/${id}`, { name });
    setWatchlists(prev => prev.map(w => (w.id === id ? res.data : w)));
  }, []);

  // ── Delete ──
  const deleteWatchlist = useCallback(async (id: string) => {
    await apiClient.delete(`/api/watchlists/${id}`);
    setWatchlists(prev => {
      const next = prev.filter(w => w.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

  // ── Add symbol ──
  const addSymbol = useCallback(async (watchlistId: string, symbol: string) => {
    const res = await apiClient.post<WatchlistItem>(
      `/api/watchlists/${watchlistId}/items`,
      { symbol }
    );
    setWatchlists(prev =>
      prev.map(w =>
        w.id === watchlistId
          ? { ...w, items: [...w.items, res.data] }
          : w
      )
    );
    return res.data;
  }, []);

  // ── Remove symbol ──
  const removeSymbol = useCallback(async (watchlistId: string, itemId: string) => {
    await apiClient.delete(`/api/watchlists/${watchlistId}/items/${itemId}`);
    setWatchlists(prev =>
      prev.map(w =>
        w.id === watchlistId
          ? { ...w, items: w.items.filter(i => i.id !== itemId) }
          : w
      )
    );
  }, []);

  // ── Reorder items (optimistic) ──
  const reorderItems = useCallback(
    async (watchlistId: string, reorderedItems: WatchlistItem[]) => {
      // Optimistic update
      setWatchlists(prev =>
        prev.map(w =>
          w.id === watchlistId ? { ...w, items: reorderedItems } : w
        )
      );
      // Persist new sort_order values
      const payload = reorderedItems.map((item, idx) => ({
        id: item.id,
        sort_order: idx,
      }));
      try {
        await apiClient.put(`/api/watchlists/${watchlistId}`, { items: payload });
      } catch {
        // On failure, re-fetch to restore server state
        const res = await apiClient.get<Watchlist[]>('/api/watchlists');
        setWatchlists(res.data ?? []);
      }
    },
    []
  );

  return {
    watchlists,
    activeId,
    setActiveId,
    activeWatchlist,
    loading,
    error,
    fetchAll,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addSymbol,
    removeSymbol,
    reorderItems,
  };
}

// ─── WatchlistTabs ────────────────────────────────────────────────────────────
// Horizontal scrollable tab strip with + New button.

interface WatchlistTabsProps {
  watchlists: Watchlist[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function WatchlistTabs({
  watchlists,
  activeId,
  onSelect,
  onCreate,
}: WatchlistTabsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-4">
      {watchlists.map(wl => (
        <button
          key={wl.id}
          onClick={() => onSelect(wl.id)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap',
            activeId === wl.id
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-zinc-900/50 border border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
          )}
        >
          {wl.name}
          <span
            className={cn(
              'ml-1.5 text-[8px]',
              activeId === wl.id ? 'text-black/60' : 'text-zinc-600'
            )}
          >
            {wl.items.length}
          </span>
        </button>
      ))}

      {/* + New Watchlist */}
      <button
        onClick={onCreate}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all"
      >
        <Plus size={10} />
        <span className="text-[9px] font-bold uppercase tracking-widest">New</span>
      </button>
    </div>
  );
}

// ─── WatchlistToolbar ─────────────────────────────────────────────────────────
// Edit (rename) + Delete actions for the active watchlist.

interface WatchlistToolbarProps {
  watchlist: Watchlist;
  onRename: () => void;
  onDelete: () => void;
}

export function WatchlistToolbar({
  watchlist,
  onRename,
  onDelete,
}: WatchlistToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 mb-2">
      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
        {watchlist.items.length} symbol{watchlist.items.length !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onRename}
          className="p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 text-zinc-500 hover:text-zinc-300 transition-all"
          aria-label="Rename watchlist"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 text-zinc-500 hover:text-rose-400 transition-all"
          aria-label="Delete watchlist"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── NewWatchlistDialog ───────────────────────────────────────────────────────

interface NewWatchlistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<any>; 
}

export function NewWatchlistDialog({
  isOpen,
  onClose,
  onCreate,
}: NewWatchlistDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('Please enter a name'); return; }
    setBusy(true);
    setErr('');
    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to create watchlist');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl p-6 space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white tracking-tight">New Watchlist</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-zinc-900 text-zinc-500">
                <X size={16} />
              </button>
            </div>

            <div>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder="e.g. Swing Trades, Breakouts, NIFTY50..."
                value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                maxLength={50}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              {err && <p className="text-[10px] text-rose-500 mt-1.5 ml-1">{err}</p>}
              <p className="text-[9px] text-zinc-600 mt-1.5 ml-1 text-right">{name.length}/50</p>
            </div>

            <button
              disabled={busy || !name.trim()}
              onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 text-black font-bold text-[13px] disabled:opacity-40 transition-all"
            >
              {busy ? 'Creating...' : 'Create Watchlist'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── RenameWatchlistDialog ────────────────────────────────────────────────────

interface RenameWatchlistDialogProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}

export function RenameWatchlistDialog({
  isOpen,
  currentName,
  onClose,
  onRename,
}: RenameWatchlistDialogProps) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Sync when dialog opens
  React.useEffect(() => {
    if (isOpen) { setName(currentName); setErr(''); }
  }, [isOpen, currentName]);

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('Name cannot be empty'); return; }
    setBusy(true);
    setErr('');
    try {
      await onRename(name.trim());
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to rename');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl p-6 space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Rename Watchlist</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-zinc-900 text-zinc-500">
                <X size={16} />
              </button>
            </div>
            <div>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                maxLength={50}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              {err && <p className="text-[10px] text-rose-500 mt-1.5 ml-1">{err}</p>}
            </div>
            <button
              disabled={busy || !name.trim() || name.trim() === currentName}
              onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 text-black font-bold text-[13px] disabled:opacity-40 transition-all"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── DeleteWatchlistDialog ────────────────────────────────────────────────────

interface DeleteWatchlistDialogProps {
  isOpen: boolean;
  watchlistName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteWatchlistDialog({
  isOpen,
  watchlistName,
  onClose,
  onConfirm,
}: DeleteWatchlistDialogProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleConfirm = async () => {
    setBusy(true);
    setErr('');
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-rose-500" />
              </div>
              <h3 className="text-sm font-bold text-white">Delete "{watchlistName}"?</h3>
              <p className="text-[11px] text-zinc-500 max-w-[28ch] mx-auto">
                This will permanently remove the watchlist and all its symbols. This cannot be undone.
              </p>
            </div>
            {err && <p className="text-[10px] text-rose-500 text-center">{err}</p>}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-[12px] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-bold text-[12px] disabled:opacity-40 transition-all"
              >
                {busy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── AddSymbolSheet ───────────────────────────────────────────────────────────
// Bottom sheet to search & add a symbol to the active watchlist.

interface AddSymbolSheetProps {
  isOpen: boolean;
  watchlistId: string;
  existingSymbols: string[];
  stocks: Record<string, any>;
  onClose: () => void;
  onAdd: (watchlistId: string, symbol: string) => Promise<any>;
}

export function AddSymbolSheet({
  isOpen,
  watchlistId,
  existingSymbols,
  stocks,
  onClose,
  onAdd,
}: AddSymbolSheetProps) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const allSymbols = Object.keys(stocks).filter(
    s => !['NIFTY 50', 'SENSEX', 'BANKNIFTY', 'FINNIFTY', 'MIDCAP NIFTY', 'SMALLCAP NIFTY'].includes(s)
  );

  const filtered = allSymbols
    .filter(s => s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);

  const handleAdd = async (symbol: string) => {
    setAdding(symbol);
    setErr('');
    try {
      await onAdd(watchlistId, symbol);
      setQuery('');
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to add symbol');
    } finally {
      setAdding(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setQuery(''); onClose(); } }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '75vh' }}
          >
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Add Symbol</h3>
                <button onClick={() => { setQuery(''); onClose(); }} className="p-2 rounded-xl bg-zinc-900 text-zinc-500">
                  <X size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={13} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search symbol..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              {err && <p className="text-[10px] text-rose-500 ml-1">{err}</p>}
            </div>

            {/* Results */}
            <div className="overflow-y-auto pb-8 px-5 space-y-1" style={{ maxHeight: 'calc(75vh - 160px)' }}>
              {filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="mx-auto text-zinc-700 mb-2" size={24} />
                  <p className="text-[12px] text-zinc-600">No symbols found for "{query}"</p>
                </div>
              ) : (
                filtered.map(symbol => {
                  const alreadyAdded = existingSymbols.includes(symbol);
                  const quote = stocks[symbol];
                  const ltp = typeof quote === 'number' ? quote : (quote?.ltp || 0);
                  const changePct = quote?.day_change_pct;
                  const isPositive = changePct !== undefined && changePct >= 0;

                  return (
                    <div
                      key={symbol}
                      className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-zinc-900/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center font-bold text-[10px] text-zinc-500 border border-zinc-800">
                          {symbol.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-white">{symbol}</p>
                          <p className="text-[9px] text-zinc-600 uppercase">NSE</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-white">{ltp.toLocaleString('en-IN')}</p>
                          {changePct !== undefined && (
                            <p className={cn('text-[9px] font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
                              {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                            </p>
                          )}
                        </div>
                        {alreadyAdded ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Check size={12} className="text-emerald-500" />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAdd(symbol)}
                            disabled={adding === symbol}
                            className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-500 flex items-center justify-center text-zinc-500 transition-all disabled:opacity-40"
                          >
                            {adding === symbol ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── WatchlistSymbolRow ───────────────────────────────────────────────────────
// One draggable row in the watchlist. Uses framer-motion Reorder.Item.

interface WatchlistSymbolRowProps {
  item: WatchlistItem;
  quote: any;
  onStockClick: (symbol: string) => void;
  onRemove: (itemId: string) => void;
}

export function WatchlistSymbolRow({
  item,
  quote,
  onStockClick,
  onRemove,
}: WatchlistSymbolRowProps) {
  const token = useAuthStore(state => state.token);
  const tickData = useMarketDataStore(state => state.ticks[item.symbol]);
  const [showRemove, setShowRemove] = useState(false);

  // Hook into Upstox WebSocket on mount
  useEffect(() => {
    if (token && item.symbol) {
      wsClient.connect(token);
      // 'ltpc' mode sends only LTP and Close Price, perfect for watchlists
      wsClient.subscribe([item.symbol], 'ltpc'); 
    }
    return () => {
      if (item.symbol) wsClient.unsubscribe([item.symbol]);
    };
  }, [token, item.symbol]);

  // Use real-time WebSocket tick data, fallback to static quote if WS is connecting
  const ltp = tickData?.ltp || (typeof quote === 'number' ? quote : (quote?.ltp || 0));
  const closePrice = tickData?.close || (typeof quote === 'object' ? quote?.close_price : 0);
  
  // Calculate day change percentage based on Live close vs live LTP
  let changePct = quote?.day_change_pct;
  if (closePrice && ltp && closePrice > 0) {
    changePct = ((ltp - closePrice) / closePrice) * 100;
  }
  
  const isPositive = changePct !== undefined && changePct >= 0;

  return (
    <Reorder.Item
      key={item.id}
      value={item}
      as="div"
      dragListener={false} // controlled via drag handle
      className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-800/30 rounded-xl flex items-center transition-all cursor-pointer group"
      style={{ touchAction: 'none' }}
    >
      {/* Drag handle */}
      <Reorder.Item
        value={item}
        key={`handle-${item.id}`}
        as="div"
        className="px-2.5 py-3.5 text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
        dragListener
      >
        <GripVertical size={14} />
      </Reorder.Item>

      {/* Main content */}
      <div
        className="flex-1 flex justify-between items-center py-3 pr-3"
        onClick={() => onStockClick(item.symbol)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-500">
            {item.symbol.substring(0, 2)}
          </div>
          <div>
            <p className="text-[13px] font-bold text-white tracking-tight">{item.symbol}</p>
            <p className="text-[9px] font-bold text-zinc-600 uppercase">NSE</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-bold text-white">{ltp.toLocaleString('en-IN')}</p>
          {changePct !== undefined ? (
            <p className={cn('text-[9px] font-bold', isPositive ? 'text-emerald-500' : 'text-rose-500')}>
              {isPositive ? '+' : ''}{changePct.toFixed(2)}%
            </p>
          ) : (
            <p className="text-[9px] font-bold text-zinc-600">—</p>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(item.id); }}
        className="px-2.5 py-3.5 text-zinc-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
        aria-label={`Remove ${item.symbol}`}
      >
        <X size={13} />
      </button>
    </Reorder.Item>
  );
}