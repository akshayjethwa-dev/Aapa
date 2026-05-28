// src/store/marketDataStore.ts
import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface TickData {
  ltp?: number;
  close?: number;
  prevClose?: number; 
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  bidPrice?: number;
  bidQty?: number;
  askPrice?: number;
  askQty?: number;
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
  ticks: Record<string, TickData>;
  updateTick: (instrumentKey: string, data: Partial<TickData>) => void;
  updateMultipleTicks: (updates: Record<string, Partial<TickData>>) => void;
  clearData: () => void;
  
  fetchClosingQuotes: (instrumentKeys: string[]) => Promise<void>;

  dashboardNews: DashboardNews[];
  topGainers: MarketMover[];
  topLosers: MarketMover[];
  isLoadingDashboard: boolean;
  
  // ✅ FIX: Dynamic Market Status State
  isMarketOpen: boolean;
  marketPhase: string;
  fetchMarketStatus: () => Promise<boolean>;
  
  fetchDashboardData: () => Promise<void>;
}

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

  fetchClosingQuotes: async (instrumentKeys) => {
    if (!instrumentKeys || instrumentKeys.length === 0) return;
    try {
      const response = await apiClient.get('/api/market/quotes', {
        params: { keys: instrumentKeys.join(',') }
      });
      const quotes = response.data?.data || {};
      const batchUpdates: Record<string, Partial<TickData>> = {};
      
      for (const [key, quote] of Object.entries<any>(quotes)) {
        batchUpdates[key] = {
          ltp: quote.last_price,
          close: quote.ohlc?.close || quote.last_price,
          open: quote.ohlc?.open,
          high: quote.ohlc?.high,
          low: quote.ohlc?.low,
        };
      }
      
      if (Object.keys(batchUpdates).length > 0) {
        get().updateMultipleTicks(batchUpdates);
      }
    } catch (error) {
      console.error('Error fetching closing quotes:', error);
    }
  },

  dashboardNews: [],
  topGainers: [],
  topLosers: [],
  isLoadingDashboard: false,
  
  isMarketOpen: false,
  marketPhase: 'CLOSED',
  
  fetchMarketStatus: async () => {
    try {
      const res = await apiClient.get('/api/market/status');
      const isOpen = res.data?.isOpen ?? false;
      const phase = res.data?.phase || 'CLOSED';
      set({ isMarketOpen: isOpen, marketPhase: phase });
      return isOpen;
    } catch (e) {
      console.error('Error fetching market status:', e);
      return false;
    }
  },

  fetchDashboardData: async () => {
    set({ isLoadingDashboard: true });
    try {
      const [newsRes, moversRes, statusRes] = await Promise.all([
        apiClient.get('/api/market/news'),
        apiClient.get('/api/market/movers'),
        apiClient.get('/api/market/status') // Parallel fetch guarantees fresh UI mapping
      ]);

      set({ 
        dashboardNews: newsRes.data?.data || [],
        topGainers: moversRes.data?.gainers || [],
        topLosers: moversRes.data?.losers || [],
        isMarketOpen: statusRes.data?.isOpen ?? false,
        marketPhase: statusRes.data?.phase || 'CLOSED'
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      set({ isLoadingDashboard: false });
    }
  }
}));