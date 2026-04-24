export const INDEX_CONSTITUENTS: Record<string, string[]> = {
  "NIFTY 50": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK"],
  "BANKNIFTY": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "AUBANK", "BANDHANBNK", "FEDERALBNK", "IDFCFIRSTB"],
  "FINNIFTY": ["HDFCBANK", "ICICIBANK", "HDFCLIFE", "SBILIFE", "BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "RECLTD", "PFC", "MUTHOOTFIN"],
  "MIDCAP NIFTY": ["AUROPHARMA", "CUMMINSIND", "FEDERALBNK", "IDFCFIRSTB", "MPHASIS", "PERSISTENT", "POLYCAB", "TATACOMM", "VOLTAS", "YESBANK"],
  "SENSEX": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK"],
  "NIFTY IT": ["TCS", "INFY", "HCLTECH", "WIPRO", "LTIM", "TECHM", "PERSISTENT", "COFORGE", "MPHASIS", "KPITTECH"],
};

export const F_O_INDICES = ["NIFTY 50", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY"];

// Corrected Mapping for proper TradingView Indian symbols
export const TRADING_VIEW_SYMBOL_MAP: Record<string, string> = {
  'NIFTY 50': 'NSE:NIFTY',
  'BANKNIFTY': 'NSE:NIFTYBANK',    // Corrected
  'FINNIFTY': 'NSE:FINNIFTY',      // Corrected
  'MIDCAP NIFTY': 'NSE:MIDCPNIFTY',
  'SMALLCAP NIFTY': 'NSE:CNXSMALLCAP',
  'SENSEX': 'BSE:SENSEX',
  'BANKEX': 'BSE:BANKEX',
  'NIFTY IT': 'NSE:CNXIT',
  'NIFTY AUTO': 'NSE:CNXAUTO',
  'NIFTY PHARMA': 'NSE:CNXPHARMA',
  'NIFTY METAL': 'NSE:CNXMETAL',
  'NIFTY FMCG': 'NSE:CNXFMCG',
  'NIFTY REALTY': 'NSE:CNXREALTY',
  'NIFTY ENERGY': 'NSE:CNXENERGY',
  'INDIA VIX': 'NSE:INDIAVIX',
};

export const getTradingViewSymbol = (s: string): string => {
  if (!s) return 'NSE:NIFTY';
  if (s.includes(':')) return s;
  
  if (s.includes(' CE') || s.includes(' PE')) {
    const parts = s.split(' ');
    const base = parts[0] === 'NIFTY' ? 'NIFTY 50' : parts[0]; 
    return TRADING_VIEW_SYMBOL_MAP[base] || `NSE:${base}`;
  }
  
  return TRADING_VIEW_SYMBOL_MAP[s] || `NSE:${s}`;
};