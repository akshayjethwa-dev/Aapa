import { create } from 'zustand';

export interface TickData {
  ltp?: number;
  close?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  bidPrice?: number;
  bidQty?: number;
  askPrice?: number;
  askQty?: number;
}

interface MarketDataState {
  ticks: Record<string, TickData>;
  updateTick: (instrumentKey: string, data: Partial<TickData>) => void;
  updateMultipleTicks: (updates: Record<string, Partial<TickData>>) => void;
  clearData: () => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  ticks: {},
  // Update a single instrument's tick data
  updateTick: (instrumentKey, data) => set((state) => ({
    ticks: {
      ...state.ticks,
      [instrumentKey]: { ...(state.ticks[instrumentKey] || {}), ...data }
    }
  })),
  // Batch update multiple instruments (better for performance on high-frequency feeds)
  updateMultipleTicks: (updates) => set((state) => {
    const newTicks = { ...state.ticks };
    for (const [key, data] of Object.entries(updates)) {
      newTicks[key] = { ...(newTicks[key] || {}), ...data };
    }
    return { ticks: newTicks };
  }),
  clearData: () => set({ ticks: {} })
}));