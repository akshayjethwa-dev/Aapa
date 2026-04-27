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
  // Added fields to standardize change across the app
  day_change?: number;     
  day_change_pct?: number; 
}

interface MarketDataState {
  ticks: Record<string, TickData>;
  updateTick: (instrumentKey: string, data: Partial<TickData>) => void;
  updateMultipleTicks: (updates: Record<string, Partial<TickData>>) => void;
  clearData: () => void;
}

// ── INTERNAL HELPER ────────────────────────────────────────────────────────
// Automatically calculates the exact point change and percentage change 
// whenever a new tick arrives with an LTP and a Previous Close.
const processTick = (existing: TickData = {}, incoming: Partial<TickData>): TickData => {
  const updated = { ...existing, ...incoming };
  
  if (updated.ltp !== undefined && updated.close !== undefined && updated.close > 0) {
    updated.day_change = updated.ltp - updated.close;
    updated.day_change_pct = (updated.day_change / updated.close) * 100;
  }
  
  return updated;
};
// ───────────────────────────────────────────────────────────────────────────

export const useMarketDataStore = create<MarketDataState>((set) => ({
  ticks: {},
  
  // Update a single instrument's tick data
  updateTick: (instrumentKey, data) => set((state) => ({
    ticks: {
      ...state.ticks,
      [instrumentKey]: processTick(state.ticks[instrumentKey], data)
    }
  })),
  
  // Batch update multiple instruments (better for performance on high-frequency feeds)
  updateMultipleTicks: (updates) => set((state) => {
    const newTicks = { ...state.ticks };
    for (const [key, data] of Object.entries(updates)) {
      newTicks[key] = processTick(newTicks[key], data);
    }
    return { ticks: newTicks };
  }),
  
  clearData: () => set({ ticks: {} })
}));