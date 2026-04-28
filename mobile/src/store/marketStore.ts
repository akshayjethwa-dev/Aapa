/**
 * marketStore.ts
 *
 * Zustand store that holds live ticker data fed by useMarketWebSocket.
 *
 * Any screen can import useMarketStore() to read real-time prices
 * without needing to manage WebSocket connections themselves.
 *
 * Persisted across restarts (via AsyncStorage):
 *   - favorites: list of symbol strings the user has starred
 *   - lastTab: last active sub-tab on the Market screen ('Indices' | 'Stocks' | 'Favorites')
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TickerData } from '../hooks/useMarketWebSocket';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const PERSIST_KEY = 'market_persisted_state';

// Shape of what we save to AsyncStorage
interface PersistedMarketState {
  favorites: string[];
  lastTab: string;
}

interface MarketState {
  /** Map of instrument_token → latest ticker data */
  tickers: Record<string, TickerData>;
  connectionStatus: ConnectionStatus;
  /** Unix timestamp (ms) of the last ticker update — used to detect stale data */
  lastUpdated: number | null;

  /** Persisted: symbols the user has starred */
  favorites: string[];
  /** Persisted: last active sub-tab on the Market screen */
  lastTab: string;

  // ── Live actions ──────────────────────────────────────────────────────────
  setTickers: (incoming: Record<string, TickerData>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastUpdated: (ts: number) => void;
  clearTickers: () => void;

  // ── Persisted actions ─────────────────────────────────────────────────────
  /** Toggle a symbol in/out of favorites and persist to AsyncStorage */
  toggleFavorite: (symbol: string) => void;
  /** Set the active Market sub-tab and persist to AsyncStorage */
  setLastTab: (tab: string) => void;
  /** Load favorites + lastTab from AsyncStorage — call once on app start */
  hydrateFromStorage: () => Promise<void>;
}

// ─── Internal helper: write persisted slice to AsyncStorage ─────────────────
async function savePersisted(state: PersistedMarketState) {
  try {
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[marketStore] savePersisted error:', e);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export const useMarketStore = create<MarketState>((set, get) => ({
  tickers: {},
  connectionStatus: 'disconnected',
  lastUpdated: null,
  favorites: [],
  lastTab: 'Indices',

  // ── Hydration ──────────────────────────────────────────────────────────────
  hydrateFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(PERSIST_KEY);
      if (raw) {
        const parsed: PersistedMarketState = JSON.parse(raw);
        set({
          favorites: parsed.favorites ?? [],
          lastTab: parsed.lastTab ?? 'Indices',
        });
      }
    } catch (e) {
      console.warn('[marketStore] hydrateFromStorage error:', e);
    }
  },

  // ── Live actions ───────────────────────────────────────────────────────────

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

  // ── Persisted actions ──────────────────────────────────────────────────────

  toggleFavorite: (symbol) => {
    const current = get().favorites;
    const next = current.includes(symbol)
      ? current.filter((s) => s !== symbol)
      : [...current, symbol];
    set({ favorites: next });
    savePersisted({ favorites: next, lastTab: get().lastTab });
  },

  setLastTab: (tab) => {
    set({ lastTab: tab });
    savePersisted({ favorites: get().favorites, lastTab: tab });
  },
}));