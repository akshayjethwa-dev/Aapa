/**
 * useMarketWebSocket.ts
 * User Story 3.1 — AppState-aware WebSocket lifecycle.
 *
 * FIX: Removed direct SecureStore.getItemAsync() call.
 * The Upstox token is now read from the already-hydrated Zustand
 * authStore state — works on both native and web.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useMarketStore } from '../store/marketStore';
import { apiClient } from '../api/client';

// ─── env ───────────────────────────────────────────────────────────────────
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://aapa-production.up.railway.app';

const WS_URL =
  API_BASE.replace(/^https?/, (p: string) => (p === 'https' ? 'wss' : 'ws')) +
  '/ws/market';

const RECONNECT_DELAY_MS = 1500;

// ─── types ─────────────────────────────────────────────────────────────────
export interface TickerData {
  instrument_token: string;
  last_price: number;
  volume?: number;
  change?: number;
  change_percent?: number;
  ohlc?: { open: number; high: number; low: number; close: number };
  timestamp?: string;
}

// ─── hook ──────────────────────────────────────────────────────────────────
export function useMarketWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  // Mutex: prevents duplicate sockets during rapid fg/bg switching
  const isConnectingRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Read token from Zustand store — already hydrated, works on web + native
  const upstoxAccessToken = useAuthStore((s) => s.upstoxAccessToken);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  const { setTickers, setConnectionStatus, setLastUpdated } = useMarketStore();

  // ── helpers ───────────────────────────────────────────────────────────────

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(
    (reason = 'app-backgrounded') => {
      clearReconnectTimer();
      isConnectingRef.current = false;

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;

        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close(1000, reason);
        }
        wsRef.current = null;
      }
      setConnectionStatus('disconnected');
      console.log('[useMarketWebSocket] disconnected:', reason);
    },
    [clearReconnectTimer, setConnectionStatus]
  );

  const fetchSnapshot = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Record<string, TickerData>>(
        '/api/broker/upstox/market/snapshot'
      );
      if (data) {
        setTickers(data);
        setLastUpdated(Date.now());
        console.log(
          '[useMarketWebSocket] snapshot fetched, instruments:',
          Object.keys(data).length
        );
      }
    } catch (err) {
      console.warn('[useMarketWebSocket] snapshot fetch failed (non-fatal):', err);
    }
  }, [setTickers, setLastUpdated]);

  // connect is a regular (non-async) callback now — token comes from closure
  const connect = useCallback(
    (token: string) => {
      // Guard 1: already connecting
      if (isConnectingRef.current) {
        console.log('[useMarketWebSocket] already connecting — skipped');
        return;
      }
      // Guard 2: socket already open
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        console.log('[useMarketWebSocket] socket already open — skipped');
        return;
      }

      isConnectingRef.current = true;
      setConnectionStatus('connecting');

      // Fire snapshot in parallel — fills gap while socket handshakes
      fetchSnapshot();

      try {
        const ws = new WebSocket(
          `${WS_URL}?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          isConnectingRef.current = false;
          setConnectionStatus('connected');
          console.log('[useMarketWebSocket] connected');
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data as string);
            if (payload?.tickers && typeof payload.tickers === 'object') {
              setTickers(payload.tickers as Record<string, TickerData>);
              setLastUpdated(Date.now());
            }
          } catch (e) {
            console.warn('[useMarketWebSocket] parse error:', e);
          }
        };

        ws.onerror = (e) => {
          console.error('[useMarketWebSocket] error:', e);
          setConnectionStatus('error');
        };

        ws.onclose = (e) => {
          isConnectingRef.current = false;
          setConnectionStatus('disconnected');
          console.log(
            `[useMarketWebSocket] closed — code=${e.code} reason="${e.reason}"`
          );

          // Auto-reconnect only for unexpected closures
          if (e.code !== 1000) {
            reconnectTimerRef.current = setTimeout(
              () => connect(token),
              RECONNECT_DELAY_MS
            );
          }
        };
      } catch (err) {
        isConnectingRef.current = false;
        setConnectionStatus('error');
        console.error('[useMarketWebSocket] failed to create WebSocket:', err);
      }
    },
    [fetchSnapshot, setConnectionStatus, setTickers, setLastUpdated]
  );

  // ── AppState listener (native only) ───────────────────────────────────────

  useEffect(() => {
    // Wait until authStore has hydrated from storage
    if (isHydrating) return;

    // No Upstox token → nothing to connect
    if (!upstoxAccessToken) {
      console.log('[useMarketWebSocket] no Upstox token — skipping');
      return;
    }

    // Connect on mount / every time the token changes
    connect(upstoxAccessToken);

    // AppState is only meaningful on native (iOS/Android)
    // On web, the browser tab visibility is handled separately below
    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          console.log('[useMarketWebSocket] AppState →', nextState);

          if (nextState === 'background' || nextState === 'inactive') {
            disconnect('app-backgrounded');
          } else if (nextState === 'active') {
            connect(upstoxAccessToken);
          }
        }
      );

      return () => {
        subscription.remove();
        disconnect('hook-unmounted');
      };
    }

    // On web: use Page Visibility API instead of AppState
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          disconnect('tab-hidden');
        } else {
          connect(upstoxAccessToken);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        disconnect('hook-unmounted');
      };
    }

    return () => {
      disconnect('hook-unmounted');
    };
  }, [isHydrating, upstoxAccessToken, connect, disconnect]);
}