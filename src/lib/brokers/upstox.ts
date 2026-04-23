import { BrokerService, Holding, BrokerPosition, OrderRequest, OrderResponse } from './types';

export class UpstoxBrokerService implements BrokerService {
  async getFunds(token: string): Promise<number> {
    const response = await fetch("https://api.upstox.com/v2/user/get-funds-and-margin", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.equity.available_margin;
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox funds');
  }

  async getHoldings(token: string): Promise<Holding[]> {
    const response = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
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

  async getPositions(token: string): Promise<BrokerPosition[]> {
    const response = await fetch("https://api.upstox.com/v2/portfolio/short-term-positions", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((p: any) => {
        const ltp = p.last_price || 0;
        const close_price = p.close_price || ltp;
        return {
          symbol: p.trading_symbol,
          quantity: p.quantity,
          average_price: p.average_price,
          current_price: ltp,
          close_price: close_price, 
          day_change: ltp - close_price,
          day_change_pct: close_price ? ((ltp - close_price) / close_price) * 100 : 0,
          product: p.product,
          broker: 'Upstox'
        };
      });
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox positions');
  }

  // --- NEW: Fetch Order History for Story A4 ---
  async getOrders(token: string): Promise<any[]> {
    const response = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((o: any) => ({
        order_id: o.order_id,
        symbol: o.trading_symbol,
        quantity: o.quantity,
        filled_quantity: o.filled_quantity || 0,
        price: o.price,
        average_price: o.average_price || 0,
        status: o.status,
        type: o.transaction_type, // BUY or SELL
        order_type: o.order_type,
        product: o.product,
        placed_at: o.order_timestamp,
        broker: 'Upstox'
      }));
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox orders');
  }

  async placeOrder(token: string, order: OrderRequest): Promise<OrderResponse> {
  try {
    const orderType = order.order_type.toUpperCase();       // MARKET | LIMIT | SL | SL-M
    const validity  = (order.validity ?? 'DAY').toUpperCase(); // DAY | IOC

    const payload: Record<string, any> = {
      quantity:           order.quantity,
      product:            order.product.toUpperCase() === 'INTRADAY' ? 'I' : 'D',
      validity:           validity,
      // MARKET and SL-M don't use a price — Upstox requires 0
      price:              ['MARKET', 'SL-M'].includes(orderType) ? 0 : (order.price ?? 0),
      // SL and SL-M require a trigger_price — others get 0
      trigger_price:      ['SL', 'SL-M'].includes(orderType) ? (order.trigger_price ?? 0) : 0,
      tag:                'AAPA_APP',
      instrument_token:   order.symbol.includes('|') ? order.symbol : `NSE_EQ|${order.symbol}`,
      order_type:         orderType,
      transaction_type:   order.type.toUpperCase(),
      disclosed_quantity: 0,
      is_amo:             false,
    };

    const response = await fetch('https://api.upstox.com/v2/order/place', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.status === 'success') {
      return { success: true, order_id: data.data.order_id, raw_response: data };
    }
    return { success: false, error: data.errors?.[0]?.message || 'Upstox order failed', raw_response: data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Upstox API Error', raw_response: { error: e.message } };
  }
}

  async refreshAccessToken(apiKey: string, apiSecret: string, refreshToken: string): Promise<{access_token: string, refresh_token?: string}> {
    const params = new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
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
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token 
      };
    }
    
    throw new Error(data.errors?.[0]?.message || 'Failed to refresh Upstox token');
  }

  // --- NEW: Fetch Historical Candles for Lightweight Charts ---
  async getHistoricalCandles(
    instrumentKey: string, 
    interval: '1minute' | 'day' | '30minute' | 'month' = 'day', 
    fromDate: string, // Format: YYYY-MM-DD
    toDate: string    // Format: YYYY-MM-DD
  ): Promise<any[]> {
    // encodeURIComponent is crucial here because instrument tokens contain a '|' (e.g., NSE_EQ|INE123...)
    const endpoint = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Upstox HTTP error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'success' && data.data?.candles) {
      return data.data.candles; // Returns array of arrays: [timestamp, open, high, low, close, volume, oi]
    }
    
    return [];
  }
}