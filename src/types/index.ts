export interface MarketQuote {
  symbol: string;
  ltp: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  day_change: number;     // Standardized from 'change'
  day_change_pct: number; // Standardized from 'changePercent'
}

export interface Stock {
  symbol: string;
  price: number;
  day_change: number;     // Standardized
  day_change_pct: number; // Standardized
}

export interface Position {
  symbol: string;
  type: string;
  quantity: number;
  avgPrice?: number;
  average_price?: number;
  ltp: number;
  day_change?: number;     // Standardized for daily instrument performance
  day_change_pct?: number; // Standardized for daily instrument performance
}

export interface Holding {
  symbol: string;
  quantity: number;
  average_price: number;
  ltp?: number;
  day_change?: number;     // Standardized
  day_change_pct?: number; // Standardized
}

export interface Transaction {
  type: string;
  symbol?: string;
  date: string;
  amount: number;
  status: string;
}

export interface MutualFund {
  name: string;
  type: string;
  amount: number;
  pnl: number;
}

export interface SIP {
  name: string;
  amount: number;
  date: string;
}

export interface OrderConfig {
  symbol?: string;
  strike?: string | number;
  optionType?: string;
  expiry?: string;
  price?: number;
  [key: string]: any;
}

export type MarketPhase = 'LIVE' | 'PRE_OPEN' | 'CLOSED';