// src/constants/symbols.ts
// Central curated symbol list for search + detail screens

export type InstrumentType = 'INDEX' | 'EQUITY';

export interface SymbolDefinition {
  /** Internal stable id */
  id: string;
  /** Display name, e.g. "NIFTY 50", "RELIANCE" */
  name: string;
  /** Searchable code/ticker, e.g. "NIFTY", "RELIANCE" */
  code: string;
  /** INDEX or EQUITY */
  type: InstrumentType;
  /** Exchange segment */
  segment: 'NSE' | 'BSE';
  /** Upstox instrument key used for charts / order placement */
  upstoxInstrumentKey: string;
}

/**
 * NOTE:
 * - Indices use NSE_INDEX / BSE_INDEX style keys, same pattern you already use
 *   in your option-chain code.[cite:7]
 * - Equities default to NSE_EQ|SYMBOL, which matches your current Upstox usage
 *   in Market / option-chain code.[cite:7][cite:9]
 */
export const SYMBOLS: SymbolDefinition[] = [
  // ── Core Indices ────────────────────────────────────────
  {
    id: 'INDEX_NIFTY_50',
    name: 'NIFTY 50',
    code: 'NIFTY',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty 50',
  },
  {
    id: 'INDEX_SENSEX',
    name: 'SENSEX',
    code: 'SENSEX',
    type: 'INDEX',
    segment: 'BSE',
    upstoxInstrumentKey: 'BSE_INDEX|SENSEX',
  },
  {
    id: 'INDEX_BANKNIFTY',
    name: 'BANKNIFTY',
    code: 'BANKNIFTY',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Bank',
  },
  {
    id: 'INDEX_FINNIFTY',
    name: 'FINNIFTY',
    code: 'FINNIFTY',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Fin Service',
  },
  {
    id: 'INDEX_MIDCAP_NIFTY',
    name: 'MIDCAP NIFTY',
    code: 'MIDCAP',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Midcap 100',
  },
  {
    id: 'INDEX_SMALLCAP_NIFTY',
    name: 'SMALLCAP NIFTY',
    code: 'SMALLCAP',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Smallcap 100',
  },
  {
    id: 'INDEX_NIFTY_IT',
    name: 'NIFTY IT',
    code: 'NIFTYIT',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty IT',
  },
  {
    id: 'INDEX_NIFTY_AUTO',
    name: 'NIFTY AUTO',
    code: 'NIFTYAUTO',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Auto',
  },
  {
    id: 'INDEX_NIFTY_PHARMA',
    name: 'NIFTY PHARMA',
    code: 'NIFTYPHARMA',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Pharma',
  },
  {
    id: 'INDEX_NIFTY_METAL',
    name: 'NIFTY METAL',
    code: 'NIFTYMETAL',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Metal',
  },
  {
    id: 'INDEX_NIFTY_FMCG',
    name: 'NIFTY FMCG',
    code: 'NIFTYFMCG',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty FMCG',
  },
  {
    id: 'INDEX_NIFTY_REALTY',
    name: 'NIFTY REALTY',
    code: 'NIFTYREALTY',
    type: 'INDEX',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_INDEX|Nifty Realty',
  },

  // ── Key NIFTY 50 / Bank / IT names ─────────────────────
  {
    id: 'EQ_RELIANCE',
    name: 'RELIANCE',
    code: 'RELIANCE',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|RELIANCE',
  },
  {
    id: 'EQ_TCS',
    name: 'TCS',
    code: 'TCS',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|TCS',
  },
  {
    id: 'EQ_HDFCBANK',
    name: 'HDFCBANK',
    code: 'HDFCBANK',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|HDFCBANK',
  },
  {
    id: 'EQ_INFOSYS',
    name: 'INFY',
    code: 'INFY',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|INFY',
  },
  {
    id: 'EQ_ICICIBANK',
    name: 'ICICIBANK',
    code: 'ICICIBANK',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|ICICIBANK',
  },
  {
    id: 'EQ_HINDUNILVR',
    name: 'HINDUNILVR',
    code: 'HINDUNILVR',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|HINDUNILVR',
  },
  {
    id: 'EQ_ITC',
    name: 'ITC',
    code: 'ITC',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|ITC',
  },
  {
    id: 'EQ_SBIN',
    name: 'SBIN',
    code: 'SBIN',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|SBIN',
  },
  {
    id: 'EQ_BHARTIARTL',
    name: 'BHARTIARTL',
    code: 'BHARTIARTL',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|BHARTIARTL',
  },
  {
    id: 'EQ_KOTAKBANK',
    name: 'KOTAKBANK',
    code: 'KOTAKBANK',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|KOTAKBANK',
  },
  {
    id: 'EQ_AXISBANK',
    name: 'AXISBANK',
    code: 'AXISBANK',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|AXISBANK',
  },

  // ── “Stocks in news / volume rockers” you already use ──
  {
    id: 'EQ_TATASTEEL',
    name: 'TATASTEEL',
    code: 'TATASTEEL',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|TATASTEEL',
  },
  {
    id: 'EQ_ADANIENT',
    name: 'ADANIENT',
    code: 'ADANIENT',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|ADANIENT',
  },
  {
    id: 'EQ_ZOMATO',
    name: 'ZOMATO',
    code: 'ZOMATO',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|ZOMATO',
  },
  {
    id: 'EQ_PAYTM',
    name: 'PAYTM',
    code: 'PAYTM',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|PAYTM',
  },
  {
    id: 'EQ_JIOFIN',
    name: 'JIOFIN',
    code: 'JIOFIN',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|JIOFIN',
  },
  {
    id: 'EQ_YESBANK',
    name: 'YESBANK',
    code: 'YESBANK',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|YESBANK',
  },
  {
    id: 'EQ_SUZLON',
    name: 'SUZLON',
    code: 'SUZLON',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|SUZLON',
  },
  {
    id: 'EQ_IDEA',
    name: 'IDEA',
    code: 'IDEA',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|IDEA',
  },
  {
    id: 'EQ_RVNL',
    name: 'RVNL',
    code: 'RVNL',
    type: 'EQUITY',
    segment: 'NSE',
    upstoxInstrumentKey: 'NSE_EQ|RVNL',
  },
];

export const INDEX_SYMBOLS = SYMBOLS.filter((s) => s.type === 'INDEX');
export const EQUITY_SYMBOLS = SYMBOLS.filter((s) => s.type === 'EQUITY');

export const filterSymbols = (query: string): SymbolDefinition[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SYMBOLS.filter((s) => {
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  });
};

export const findSymbolByName = (name: string): SymbolDefinition | undefined =>
  SYMBOLS.find((s) => s.name === name);