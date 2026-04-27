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
  'BANKNIFTY': 'NSE:NIFTYBANK',
  'FINNIFTY': 'NSE:FINNIFTY', 
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

// Map specifically for Continuous Futures (1!) for F&O contracts
export const TRADING_VIEW_FUTURES_MAP: Record<string, string> = {
  'NIFTY': 'NSE:NIFTY1!',
  'NIFTY 50': 'NSE:NIFTY1!',
  'BANKNIFTY': 'NSE:BANKNIFTY1!',
  'FINNIFTY': 'NSE:FINNIFTY1!',
  'MIDCPNIFTY': 'NSE:MIDCPNIFTY1!',
  'MIDCAP NIFTY': 'NSE:MIDCPNIFTY1!',
  'SENSEX': 'BSE:SENSEX1!',
};

export const getTradingViewSymbol = (s: string): string => {
  if (!s) return 'NSE:NIFTY';
  
  // If it's already a TradingView formatted string with an exchange prefix
  if (s.includes(':')) return s;
  
  // Detect Options (CE/PE) or Futures (FUT) strings
  // e.g., "NIFTY 24MAY 22000 CE", "BANKNIFTY24MAYFUT", "RELIANCE 2500 CE"
  const isOptionsOrFutures = s.includes(' CE') || s.includes(' PE') || s.includes(' FUT') || s.match(/[0-9]+(CE|PE|FUT)$/i);
  
  if (isOptionsOrFutures) {
    // Extract the base asset (e.g., "NIFTY", "RELIANCE")
    const parts = s.split(' ');
    const base = parts[0]; 
    
    // Attempt to return the continuous future for indices or default to standard stock futures format
    return TRADING_VIEW_FUTURES_MAP[base] || `NSE:${base}1!`;
  }
  
  return TRADING_VIEW_SYMBOL_MAP[s] || `NSE:${s}`;
};