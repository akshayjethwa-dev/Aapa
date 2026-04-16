export interface MarketQuote {
  symbol: string;
  ltp: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
}

export interface Stock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface Position {
  symbol: string;
  type: string;
  quantity: number;
  avgPrice?: number;
  average_price?: number;
  ltp: number;
  change?: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  average_price: number;
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