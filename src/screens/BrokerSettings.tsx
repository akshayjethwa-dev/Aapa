// src/screens/BrokerSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, CheckCircle2, XCircle, RefreshCw, Unlink,
  AlertTriangle, ChevronLeft, Clock, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

interface BrokerInfo {
  broker: string;
  is_connected: boolean;
  last_updated: string | null;
}

interface BrokerSettingsProps {
  onBack: () => void;
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
}

const BROKER_META: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  upstox: {
    label: 'Upstox',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    description: 'Equity, F&O, Commodity & Currency trading via Upstox Pro API',
  },
};

const formatLastUpdated = (ts: string | null): string => {
  if (!ts) return 'Never';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DisconnectConfirmModal = ({
  brokerLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  brokerLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Backdrop */}
    <motion.div
      className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    />

    {/* Sheet */}
    <motion.div
      className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-rose-500/10">
          <AlertTriangle size={22} className="text-rose-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Disconnect {brokerLabel}?</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">This will remove your broker link</p>
        </div>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed">
        You won't be able to place trades until you reconnect. Any open positions
        will <span className="text-amber-400 font-semibold">not be closed automatically</span> — 
        manage them directly on Upstox before disconnecting.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-3.5 rounded-2xl border border-zinc-700 text-zinc-300 font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 py-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm hover:bg-rose-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Unlink size={16} />
          )}
          {isLoading ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const BrokerSettings: React.FC<BrokerSettingsProps> = ({
  onBack,
  onConnectUptox,
  isConnectingUptox,
}) => {
  const { user, token, setAuth } = useAuthStore();
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchBrokers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/user/brokers');
      setBrokers(res.data.brokers || []);
    } catch (e) {
      toast.error('Failed to load broker status');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  const handleDisconnect = async (brokerName: string) => {
    setIsDisconnecting(true);
    try {
      if (brokerName === 'upstox') {
        await apiClient.delete('/api/auth/uptox');

        // Update local user state
        if (user && token) {
          setAuth({ ...user, is_uptox_connected: false }, token);
        }

        // Refresh broker list
        setBrokers(prev =>
          prev.map(b =>
            b.broker === brokerName
              ? { ...b, is_connected: false, last_updated: null }
              : b
          )
        );

        toast.success('Upstox disconnected successfully');
        setConfirmDisconnect(null);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to disconnect broker';
      toast.error(msg);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnect = (brokerName: string) => {
    if (brokerName === 'upstox') {
      onConnectUptox();
    }
  };

  return (
    <>
      <div className="min-h-screen pb-24">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-zinc-800/60 transition-colors"
          >
            <ChevronLeft size={22} className="text-zinc-300" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white">Linked Brokers</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Manage your broker connections
            </p>
          </div>
          <button
            onClick={fetchBrokers}
            disabled={isLoading}
            className="ml-auto p-2 rounded-xl hover:bg-zinc-800/60 transition-colors"
          >
            <RefreshCw
              size={18}
              className={cn('text-zinc-400', isLoading && 'animate-spin text-emerald-400')}
            />
          </button>
        </div>

        <div className="px-4 pt-6 space-y-6">
          {/* ── Info Banner ── */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Upstox access tokens expire daily at <span className="font-bold text-amber-300">3:30 AM IST</span>. 
              If your connection shows as linked but trades fail, please reconnect.
            </p>
          </div>

          {/* ── Broker Cards ── */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Available Brokers
            </h2>

            {isLoading ? (
              // Skeleton
              <div className="space-y-3">
                {[1].map(i => (
                  <div key={i} className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-zinc-800 rounded-lg" />
                        <div className="h-3 w-48 bg-zinc-800/60 rounded-lg" />
                      </div>
                      <div className="h-8 w-20 bg-zinc-800 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AnimatePresence>
                {brokers.map((broker, idx) => {
                  const meta = BROKER_META[broker.broker] || {
                    label: broker.broker,
                    color: 'text-zinc-400',
                    bgColor: 'bg-zinc-800/40',
                    description: 'Broker connection',
                  };

                  return (
                    <motion.div
                      key={broker.broker}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl overflow-hidden"
                    >
                      {/* Main row */}
                      <div className="p-5 flex items-center gap-4">
                        {/* Icon */}
                        <div className={cn('p-3 rounded-2xl shrink-0', meta.bgColor)}>
                          <Zap size={22} className={meta.color} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{meta.label}</span>
                            {/* Status dot */}
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                broker.is_connected ? 'bg-emerald-500' : 'bg-zinc-600'
                              )}
                            />
                            <span
                              className={cn(
                                'text-[9px] font-black uppercase tracking-widest',
                                broker.is_connected ? 'text-emerald-500' : 'text-zinc-600'
                              )}
                            >
                              {broker.is_connected ? 'Connected' : 'Not Linked'}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{meta.description}</p>
                        </div>

                        {/* Action button */}
                        {broker.is_connected ? (
                          <button
                            onClick={() => setConfirmDisconnect(broker.broker)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                          >
                            <Unlink size={12} />
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(broker.broker)}
                            disabled={isConnectingUptox}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                          >
                            {isConnectingUptox ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Link2 size={12} />
                            )}
                            {isConnectingUptox ? 'Loading…' : 'Connect'}
                          </button>
                        )}
                      </div>

                      {/* Last updated footer */}
                      {broker.is_connected && broker.last_updated && (
                        <div className="px-5 pb-4 flex items-center gap-1.5">
                          <Clock size={10} className="text-zinc-700" />
                          <span className="text-[9px] text-zinc-700 font-medium">
                            Token last refreshed: {formatLastUpdated(broker.last_updated)}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* ── Coming Soon Brokers ── */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
              Coming Soon
            </h2>
            {['Zerodha (Kite)', 'Angel One', 'Groww Pro'].map((name, i) => (
              <div
                key={i}
                className="bg-zinc-900/20 border border-zinc-800/20 rounded-2xl p-4 flex items-center gap-4 opacity-50"
              >
                <div className="p-3 rounded-2xl bg-zinc-800/30">
                  <Zap size={18} className="text-zinc-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-zinc-500">{name}</span>
                  <p className="text-[10px] text-zinc-700 mt-0.5">Integration in progress</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700 border border-zinc-800 px-2.5 py-1 rounded-lg">
                  Soon
                </span>
              </div>
            ))}
          </div>

          {/* ── What is this section ── */}
          <div className="bg-zinc-900/20 border border-zinc-800/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-zinc-600" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Why link a broker?</span>
            </div>
            <ul className="space-y-1.5 pl-1">
              {[
                'Place real buy/sell orders directly from Aapa',
                'View live portfolio holdings & positions',
                'Track your real-time P&L',
                'F&O trading with one-tap order placement',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-700 mt-1.5 shrink-0" />
                  <span className="text-[11px] text-zinc-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Disconnect Confirm Modal ── */}
      <AnimatePresence>
        {confirmDisconnect && (
          <DisconnectConfirmModal
            brokerLabel={BROKER_META[confirmDisconnect]?.label || confirmDisconnect}
            onConfirm={() => handleDisconnect(confirmDisconnect)}
            onCancel={() => setConfirmDisconnect(null)}
            isLoading={isDisconnecting}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default BrokerSettings;