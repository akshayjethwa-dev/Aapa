// src/types/optionChain.ts
// NormalizedOptionRow — single row shape returned by /api/option-chain

export interface NormalizedOptionLeg {
  ltp: number | null;
  perc_change: number | null;
  oi: number | null;
  oi_formatted: string;
  volume: number | null;
  vol_formatted: string;
  iv: string;
  delta: string;
  theta: string;
  vega: string;
  is_active: boolean;
}

export interface NormalizedOptionRow {
  strike: number;
  ce: NormalizedOptionLeg;
  pe: NormalizedOptionLeg;
  /** true when this strike is ATM (closest to spot price) */
  isATM?: boolean;
  /** true when CE is ITM (strike < spot) */
  ceITM?: boolean;
  /** true when PE is ITM (strike > spot) */
  peITM?: boolean;
}

/** Payload passed to OrderWindow when user taps Buy/Sell on the chain */
export interface OptionOrderConfig {
  side: 'BUY' | 'SELL';
  /** Underlying index name e.g. "NIFTY" */
  symbol: string;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry: string;
  price: number;
  /** Default lot size — 1 lot */
  defaultQty: number;
  /** Default product — MIS (intraday) for F&O */
  defaultProduct: 'MIS' | 'NRML';
}