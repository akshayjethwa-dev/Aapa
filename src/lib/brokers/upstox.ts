// src/lib/brokers/upstox.ts
import { 
  BrokerService, 
  Holding, 
  BrokerPosition, 
  OrderRequest, 
  OrderResponse, 
  SquareOffRequest, 
  ConvertPositionRequest, 
  FundsData, 
  FundsSegment 
} from './types';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const normalizeUpstoxStatus = (raw: string): string => {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'complete') return 'completed';
  if (s === 'cancelled' || s === 'not_cancelled') return 'cancelled';
  if (s === 'rejected') return 'rejected';
  if (s === 'open') return 'open';
  return 'pending'; 
};

// --- QUEUE MECHANISM FOR BACKEND BROKER FETCH ---
let isUpstoxRefreshing = false;
let upstoxFailedQueue: Array<{ resolve: (token: string) => void, reject: (error: any) => void }> = [];

const processUpstoxQueue = (error: any, token: string | null = null) => {
  upstoxFailedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token as string);
  });
  upstoxFailedQueue = [];
};

export type TokenRefreshCallback = () => Promise<string>;

export class UpstoxBrokerService implements BrokerService {
  
  // Custom fetch wrapper that intercepts 401/403s and queues parallel requests
  private async fetchWithRetry(url: string, options: any, onTokenRefresh?: TokenRefreshCallback): Promise<Response> {
    let response = await fetch(url, options);
    
    if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
      if (isUpstoxRefreshing) {
        // If already refreshing, pause this request and add to queue
        return new Promise<string>((resolve, reject) => {
          upstoxFailedQueue.push({ resolve, reject });
        }).then(newToken => {
          // Replay with new token
          options.headers["Authorization"] = `Bearer ${newToken}`;
          return fetch(url, options);
        });
      }

      // First request to hit 401 triggers the refresh
      isUpstoxRefreshing = true;
      try {
        const newToken = await onTokenRefresh();
        processUpstoxQueue(null, newToken);
        
        options.headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(url, options);
      } catch (err) {
        processUpstoxQueue(err, null);
        throw err;
      } finally {
        isUpstoxRefreshing = false;
      }
    }
    return response;
  }

  async getFunds(token: string, onTokenRefresh?: TokenRefreshCallback): Promise<any> {
    const response = await this.fetchWithRetry("https://api.upstox.com/v2/user/get-funds-and-margin", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    }, onTokenRefresh);
    const data = await response.json();

    if (data.status === 'success') {
      const eq = data.data?.equity ?? {};
      const fo = data.data?.commodity ?? data.data?.fno ?? {};

      const parseSegment = (seg: any): FundsSegment => ({
        available_margin:  Number(seg.available_margin  ?? 0),
        used_margin:       Number(seg.used_margin       ?? seg.utilised_margin ?? 0),
        opening_balance:   Number(seg.opening_balance   ?? 0),
        collateral:        Number(seg.collateral        ?? 0),
        span_margin:       Number(seg.span              ?? seg.span_margin ?? 0),
        exposure_margin:   Number(seg.exposure          ?? seg.exposure_margin ?? 0),
        option_premium:    Number(seg.option_premium    ?? 0),
      });

      const equitySegment = parseSegment(eq);
      const fnoSegment    = parseSegment(fo);

      return {
        available:       equitySegment.available_margin + fnoSegment.available_margin,
        used:            equitySegment.used_margin + fnoSegment.used_margin,
        opening_balance: equitySegment.opening_balance + fnoSegment.opening_balance,
        collateral:      equitySegment.collateral + fnoSegment.collateral,
        equity:          equitySegment,
        fno:             fnoSegment,
      };
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox funds');
  }

  async getHoldings(token: string, onTokenRefresh?: TokenRefreshCallback): Promise<Holding[]> {
    const response = await this.fetchWithRetry("https://api.upstox.com/v2/portfolio/long-term-holdings", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    }, onTokenRefresh);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((h: any) => {
        const ltp = h.last_price || 0;
        const close_price = h.close_price || ltp;
        return {
          symbol: h.trading_symbol,
          quantity: h.quantity,
          average_price: h.average_price,
          current_price: ltp,
          close_price: close_price,
          day_change: ltp - close_price,
          day_change_pct: close_price ? ((ltp - close_price) / close_price) * 100 : 0,
          broker: 'Upstox'
        };
      });
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox holdings');
  }

  async getPositions(token: string, onTokenRefresh?: TokenRefreshCallback): Promise<BrokerPosition[]> {
    const response = await this.fetchWithRetry("https://api.upstox.com/v3/portfolio/short-term-positions", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    }, onTokenRefresh);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((p: any) => {
        const ltp         = p.last_price || 0;
        const close_price = p.close_price || ltp;
        const avg         = p.average_price || 0;
        const qty         = p.quantity || 0;

        const instrumentKey: string = p.instrument_token || p.instrument_key || '';
        const exchange = (p.exchange || '').toUpperCase();
        let segment = 'EQ';
        if (instrumentKey.includes('NSE_FO') || instrumentKey.includes('BSE_FO') || exchange === 'NFO' || exchange === 'BFO') segment = 'FO';
        else if (instrumentKey.includes('NSE_CD') || exchange === 'CDS') segment = 'CD';

        const pnl     = (ltp - avg) * qty;
        const day_pnl = (ltp - close_price) * qty;

        return {
          symbol:            p.trading_symbol,
          product:           p.product,
          quantity:          qty,
          avg_price:         avg,        
          average_price:     avg,        
          ltp:               ltp,
          current_price:     ltp,
          close_price:       close_price,
          pnl:               pnl,
          day_pnl:           day_pnl,
          day_change:        ltp - close_price,
          day_change_pct:    close_price ? ((ltp - close_price) / close_price) * 100 : 0,
          segment:           segment,
          instrument_token:  instrumentKey,
          broker:            'Upstox',
        };
      });
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox positions');
  }

  async getOrders(token: string, onTokenRefresh?: TokenRefreshCallback): Promise<any[]> {
    const response = await this.fetchWithRetry("https://api.upstox.com/v2/order/retrieve-all", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    }, onTokenRefresh);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((o: any) => {
        const qty: number = o.quantity || 0;
        const filledQty: number = o.filled_quantity || 0;

        let normalizedStatus = normalizeUpstoxStatus(o.status);
        if (normalizedStatus === 'open' && filledQty > 0 && filledQty < qty) {
          normalizedStatus = 'partially_filled';
        }

        return {
          order_id:         o.order_id,
          exchange_order_id: o.exchange_order_id || null,
          symbol:           o.trading_symbol,
          quantity:         qty,
          filled_quantity:  filledQty,
          price:            o.price || 0,
          average_price:    o.average_price || 0,
          trigger_price:    o.trigger_price || 0,
          validity:         o.validity || 'DAY',
          status:           normalizedStatus,
          raw_status:       o.status,
          type:             o.transaction_type,   
          order_type:       o.order_type,         
          product:          o.product,            
          placed_at:        o.order_timestamp,
          modified_at:      o.exchange_timestamp || null,
          completed_at:     normalizedStatus === 'completed' ? (o.exchange_timestamp || null) : null,
          broker:           'Upstox',
        };
      });
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox orders');
  }

  async getOrderDetails(token: string, orderId: string, onTokenRefresh?: TokenRefreshCallback): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`https://api.upstox.com/v2/order/details?order_id=${orderId}`, {
        method: 'GET',
        headers: { 
          "Authorization": `Bearer ${token}`, 
          "Accept": "application/json" 
        }
      }, onTokenRefresh);
      
      const data = await response.json();
      if (data.status === 'success' && data.data && data.data.length > 0) {
        // Upstox returns an array of history; data[0] is the latest state
        const o = data.data[0];
        
        const qty: number = o.quantity || 0;
        const filledQty: number = o.filled_quantity || 0;
        let normalizedStatus = normalizeUpstoxStatus(o.status);
        
        if (normalizedStatus === 'open' && filledQty > 0 && filledQty < qty) {
          normalizedStatus = 'partially_filled';
        }

        // Return matched structure to easily integrate into frontend state
        return {
          ...o,
          normalized_status: normalizedStatus,
          is_terminal: ['completed', 'rejected', 'cancelled'].includes(normalizedStatus)
        };
      }
      throw new Error(data.errors?.[0]?.message || 'Failed to fetch order details');
    } catch (e: any) {
      console.error("[Upstox] 🔴 Error fetching order details:", e);
      throw e;
    }
  }

  async placeOrder(token: string, order: OrderRequest, onTokenRefresh?: TokenRefreshCallback): Promise<OrderResponse> {
    try {
      const orderType = order.order_type.toUpperCase();
      const validity  = (order.validity ?? 'DAY').toUpperCase();

      // Bracket orders enforce the BO product code
      let productCode = order.product.toUpperCase() === 'INTRADAY' ? 'I' : 'D';
      if (order.is_bracket) {
        productCode = 'BO'; // Bracket Order override
      }

      const payload: Record<string, any> = {
        quantity:           order.quantity,
        product:            productCode,
        validity:           validity,
        price:              ['MARKET', 'SL-M'].includes(orderType) ? 0 : (order.price ?? 0),
        trigger_price:      ['SL', 'SL-M'].includes(orderType) ? (order.trigger_price ?? 0) : 0,
        tag:                'AAPA_APP',
        instrument_token:   order.symbol.includes('|') ? order.symbol : `NSE_EQ|${order.symbol}`,
        order_type:         orderType,
        transaction_type:   order.type.toUpperCase(),
        disclosed_quantity: 0,
        is_amo:             false,
      };

      // --- MAPPING LOGIC: Bracket Order Spreads ---
      if (order.is_bracket) {
         payload.squareoff = order.target_price || 0; 
         payload.stoploss = order.stoploss_price || 0; 
         payload.trailing_ticks = 20; // Required by Upstox (minimum trailing ticks)
      }

      const response = await this.fetchWithRetry('https://api.upstox.com/v2/order/place', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify(payload),
      }, onTokenRefresh);

      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, order_id: data.data.order_id, raw_response: data };
      }
      return { success: false, error: data.errors?.[0]?.message || 'Upstox order failed', raw_response: data };
    } catch (e: any) {
      return { success: false, error: e.message || 'Upstox API Error', raw_response: { error: e.message } };
    }
  }

  async squareOff(token: string, req: SquareOffRequest, onTokenRefresh?: TokenRefreshCallback): Promise<OrderResponse> {
    try {
      const instrumentToken = req.instrument_token
        ?? (req.symbol.includes('|') ? req.symbol : `NSE_EQ|${req.symbol}`);

      const productCode = (() => {
        const p = req.product?.toUpperCase();
        if (p === 'MIS')  return 'I';
        if (p === 'CNC')  return 'D';
        if (p === 'NRML') return 'M';
        if (p === 'BO')   return 'BO';
        return 'I';
      })();

      const payload = {
        quantity:           req.quantity,
        product:            productCode,
        validity:           'DAY',
        price:              0,
        trigger_price:      0,
        tag:                'AAPA_SQUAREOFF',
        instrument_token:   instrumentToken,
        order_type:         'MARKET',
        transaction_type:   'SELL',
        disclosed_quantity: 0,
        is_amo:             false,
      };

      const response = await this.fetchWithRetry('https://api.upstox.com/v2/order/place', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify(payload),
      }, onTokenRefresh);

      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, order_id: data.data.order_id, raw_response: data };
      }
      return {
        success: false,
        error: data.errors?.[0]?.message || 'Upstox square off failed',
        raw_response: data,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Upstox API Error', raw_response: {} };
    }
  }

  async convertPosition(
    token: string,
    req: ConvertPositionRequest,
    onTokenRefresh?: TokenRefreshCallback
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const instrumentToken = req.instrument_token
        ?? (req.symbol.includes('|') ? req.symbol : `NSE_EQ|${req.symbol}`);

      const mapProduct = (p: string) => {
        const up = p?.toUpperCase();
        if (up === 'MIS')  return 'I';
        if (up === 'CNC')  return 'D';
        if (up === 'NRML') return 'M';
        if (up === 'BO')   return 'BO';
        return up;
      };

      const payload = {
        instrument_token: instrumentToken,
        quantity:         req.quantity,
        old_product:      mapProduct(req.from_product),
        new_product:      mapProduct(req.to_product),
        transaction_type: 'BUY',
        position_type:    'TOD',
      };

      const response = await this.fetchWithRetry('https://api.upstox.com/v2/order/convert-position', {
        method:  'PUT',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify(payload),
      }, onTokenRefresh);

      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, message: `Converted to ${req.to_product}` };
      }
      return {
        success: false,
        message: data.errors?.[0]?.message || 'Upstox conversion failed',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Upstox API Error' };
    }
  }

  async refreshAccessToken(apiKey: string, apiSecret: string, refreshToken: string): Promise<{access_token: string, refresh_token?: string}> {
    const params = new URLSearchParams({
      client_id:     apiKey,
      client_secret: apiSecret,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    });

    const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
    });

    const data = await response.json();
    if (data.access_token) {
      return { access_token: data.access_token, refresh_token: data.refresh_token };
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to refresh Upstox token');
  }

  async getIntradayCandles(
    token: string,
    instrumentKey: string,
    interval: string = '1minute',
    onTokenRefresh?: TokenRefreshCallback
  ): Promise<CandleData[]> {
    try {
      const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${interval}`;
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, onTokenRefresh);

      if (response.status === 401 || response.status === 403) {
        console.error(`[Upstox] 🔴 API Error ${response.status}: Missing 'Historical API' scope or token expired.`);
        return []; 
      }

      if (!response.ok) {
        console.error(`[Upstox] HTTP error fetching candles: ${response.status}`);
        return [];
      }

      const result = await response.json();

      if (result.status === 'success' && result.data && result.data.candles) {
        return result.data.candles.map((candle: any[]) => {
          const timeInSeconds = Math.floor(new Date(candle[0]).getTime() / 1000);
          return {
            time: timeInSeconds as any, 
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
          };
        }).reverse();
      }
      return [];
    } catch (error) {
      console.error("[Upstox] 🔴 Error fetching intraday candles:", error);
      return [];
    }
  }

  async getHistoricalCandles(
    instrumentKey: string,
    interval: '1minute' | 'day' | '30minute' | 'month' = 'day',
    fromDate: string,
    toDate: string,
    options?: { signal?: AbortSignal }
  ): Promise<any[]> {
    const endpoint = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: options?.signal
    });
    if (!response.ok) throw new Error(`Upstox HTTP error: ${response.status}`);
    const data = await response.json();
    if (data.status === 'success' && data.data?.candles) return data.data.candles;
    return [];
  }

  // --- NEW METHOD FOR FETCHING CLOSING QUOTES AFTER MARKET HOURS ---
  async getClosingMarketData(
    token: string, 
    instrumentKeys: string[], 
    onTokenRefresh?: TokenRefreshCallback
  ): Promise<any> {
    try {
      // API accepts comma separated instrument keys
      const keysParams = encodeURIComponent(instrumentKeys.join(','));
      const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${keysParams}`;
      
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, onTokenRefresh);

      if (!response.ok) {
        console.error(`[Upstox] HTTP error fetching closing quotes: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.status === 'success' && data.data) {
        return data.data; // Dictionary mapped by instrument_key containing the quote details
      }
      return null;
    } catch (error) {
      console.error("[Upstox] 🔴 Error fetching closing market data:", error);
      return null;
    }
  }
}