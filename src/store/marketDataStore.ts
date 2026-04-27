import { create } from 'zustand';

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

interface MarketDataState {
  ticks: Record<string, TickData>;
  updateTick: (instrumentKey: string, data: Partial<TickData>) => void;
  updateMultipleTicks: (updates: Record<string, Partial<TickData>>) => void;
  clearData: () => void;
}

// ── INTERNAL HELPER ────────────────────────────────────────────────────────
// Automatically calculates the exact point change and percentage change 
// whenever a new tick arrives. It dynamically handles the differences 
// between raw Upstox data ('cp'), JSON fallbacks ('prevClose'), and REST ('close').
const processTick = (existing: TickData = {}, incoming: Partial<TickData>): TickData => {
  const updated = { ...existing, ...incoming };
  
  // Normalize the previous close price regardless of where the data came from
  const closePrice = updated.close || updated.prevClose || (updated as any).cp;
  
  // If we have a valid close price, enforce it back into the object for future ticks
  if (closePrice !== undefined && closePrice > 0) {
    updated.close = closePrice;
    updated.prevClose = closePrice;
    
    // Dynamically calculate the exact point drop/gain and percentage
    if (updated.ltp !== undefined) {
      updated.day_change = updated.ltp - closePrice;
      updated.day_change_pct = (updated.day_change / closePrice) * 100;
    }
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
  
  // Batch update multiple instruments (High-performance WebSocket listener)
  updateMultipleTicks: (updates) => set((state) => {
    const newTicks = { ...state.ticks };
    for (const [key, data] of Object.entries(updates)) {
      newTicks[key] = processTick(newTicks[key], data);
    }
    return { ticks: newTicks };
  }),
  
  clearData: () => set({ ticks: {} })
}));