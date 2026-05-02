// src/store/marketDataStore.ts
import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface TickData {
  ltp?: number;
  close?: number;
  prevClose?: number; // Standardized to handle both REST API and WebSocket payloads
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  bidPrice?: number;
  bidQty?: number;
  askPrice?: number;
  askQty?: number;
  // Automatically calculated fields
  day_change?: number;     
  day_change_pct?: number; 
}

interface DashboardNews {
  id: string;
  headline: string;
  source: string;
  time: string;
  url: string;
  thumb: string | null;
}

interface MarketMover {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
}

interface MarketDataState {
  // Tick logic
  ticks: Record<string, TickData>;
  updateTick: (instrumentKey: string, data: Partial<TickData>) => void;
  updateMultipleTicks: (updates: Record<string, Partial<TickData>>) => void;
  clearData: () => void;
  
  // REST Fallback logic
  fetchClosingQuotes: (instrumentKeys: string[]) => Promise<void>;

  // Dashboard Data logic
  dashboardNews: DashboardNews[];
  topGainers: MarketMover[];
  topLosers: MarketMover[];
  isLoadingDashboard: boolean;
  fetchDashboardData: () => Promise<void>;
}

// ── INTERNAL HELPER ────────────────────────────────────────────────────────
const processTick = (existing: TickData = {}, incoming: Partial<TickData>): TickData => {
  const updated = { ...existing, ...incoming };
  
  const closePrice = updated.close || updated.prevClose || (updated as any).cp;
  
  if (closePrice !== undefined && closePrice > 0) {
    updated.close = closePrice;
    updated.prevClose = closePrice;
    
    if (updated.ltp !== undefined) {
      updated.day_change = updated.ltp - closePrice;
      updated.day_change_pct = (updated.day_change / closePrice) * 100;
    }
  }
  
  return updated;
};
// ───────────────────────────────────────────────────────────────────────────

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  ticks: {},
  
  updateTick: (instrumentKey, data) => set((state) => ({
    ticks: {
      ...state.ticks,
      [instrumentKey]: processTick(state.ticks[instrumentKey], data)
    }
  })),
  
  updateMultipleTicks: (updates) => set((state) => {
    const newTicks = { ...state.ticks };
    for (const [key, data] of Object.entries(updates)) {
      newTicks[key] = processTick(newTicks[key], data);
    }
    return { ticks: newTicks };
  }),
  
  clearData: () => set({ ticks: {} }),

  // --- NEW: Fetch closing quotes for after-hours fallback ---
  fetchClosingQuotes: async (instrumentKeys) => {
    if (!instrumentKeys || instrumentKeys.length === 0) return;
    
    try {
      // Assuming your backend exposes an endpoint to fetch market quotes
      const response = await apiClient.get('/api/market/quotes', {
        params: { keys: instrumentKeys.join(',') }
      });
      
      const quotes = response.data?.data || {};
      const batchUpdates: Record<string, Partial<TickData>> = {};
      
      for (const [key, quote] of Object.entries<any>(quotes)) {
        batchUpdates[key] = {
          ltp: quote.last_price,
          close: quote.close_price,
          open: quote.open_price,
          high: quote.high_price,
          low: quote.low_price,
        };
      }
      
      if (Object.keys(batchUpdates).length > 0) {
        get().updateMultipleTicks(batchUpdates);
      }
    } catch (error) {
      console.error('Error fetching closing quotes:', error);
    }
  },

  // Dashboard implementation
  dashboardNews: [],
  topGainers: [],
  topLosers: [],
  isLoadingDashboard: false,

  fetchDashboardData: async () => {
    set({ isLoadingDashboard: true });
    try {
      const [newsRes, moversRes] = await Promise.all([
        apiClient.get('/api/market/news'),
        apiClient.get('/api/market/movers')
      ]);

      set({ 
        dashboardNews: newsRes.data?.data || [],
        topGainers: moversRes.data?.gainers || [],
        topLosers: moversRes.data?.losers || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      set({ isLoadingDashboard: false });
    }
  }
}));