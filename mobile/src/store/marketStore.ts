/**
 * marketStore.ts
 *
 * Zustand store that holds live ticker data fed by useMarketWebSocket.
 *
 * Any screen can import useMarketStore() to read real-time prices
 * without needing to manage WebSocket connections themselves.
 */

import { create } from 'zustand';
import type { TickerData } from '../hooks/useMarketWebSocket';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface MarketState {
  /** Map of instrument_token → latest ticker data */
  tickers: Record<string, TickerData>;
  connectionStatus: ConnectionStatus;
  /** Unix timestamp (ms) of the last ticker update — used to detect stale data */
  lastUpdated: number | null;

  setTickers: (incoming: Record<string, TickerData>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastUpdated: (ts: number) => void;
  clearTickers: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tickers: {},
  connectionStatus: 'disconnected',
  lastUpdated: null,

  /**
   * Merge incoming tickers into the existing map so that instruments
   * not included in this update retain their last known values.
   */
  setTickers: (incoming) =>
    set((state) => ({
      tickers: { ...state.tickers, ...incoming },
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastUpdated: (ts) => set({ lastUpdated: ts }),

  clearTickers: () => set({ tickers: {}, lastUpdated: null }),
}));