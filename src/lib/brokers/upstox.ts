import { 
  BrokerService, 
  Holding, 
  BrokerPosition, 
  OrderRequest, 
  OrderResponse, 
  SquareOffRequest, 
  ConvertPositionRequest 
} from './types';

// ─── Status Normalizer ────────────────────────────────────────────────────────
// Upstox raw statuses → normalized app statuses
// Upstox statuses: open, complete, cancelled, rejected, modify_pending,
//                  trigger_pending, put_order_req_received, validation_pending,
//                  open_pending, not_cancelled, modify_after_market_order_req_received
const normalizeUpstoxStatus = (raw: string): string => {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'complete') return 'completed';
  if (s === 'cancelled' || s === 'not_cancelled') return 'cancelled';
  if (s === 'rejected') return 'rejected';
  if (s === 'open') return 'open'; // open = live, resting order on exchange
  // Partially filled: open order with some fills — handled in getOrders mapping
  return 'pending'; // catch-all for queued/validation states
};

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
      const ltp         = p.last_price || 0;
      const close_price = p.close_price || ltp;
      const avg         = p.average_price || 0;
      const qty         = p.quantity || 0;

      // Derive segment from instrument_key prefix or exchange field
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
        avg_price:         avg,         // ← frontend-canonical field
        average_price:     avg,         // ← legacy, keep for compatibility
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

  async getOrders(token: string): Promise<any[]> {
    const response = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    const data = await response.json();
    if (data.status === 'success') {
      return data.data.map((o: any) => {
        const qty: number = o.quantity || 0;
        const filledQty: number = o.filled_quantity || 0;

        // Determine normalized status — partial fill detection:
        // An "open" order that has SOME fills but not all = partially_filled
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
          // normalized_status is the canonical field; raw_status preserved for debug
          status:           normalizedStatus,
          raw_status:       o.status,
          type:             o.transaction_type,   // BUY | SELL
          order_type:       o.order_type,         // MARKET | LIMIT | SL | SL-M
          product:          o.product,            // MIS | CNC | NRML
          placed_at:        o.order_timestamp,
          modified_at:      o.exchange_timestamp || null,
          completed_at:     normalizedStatus === 'completed' ? (o.exchange_timestamp || null) : null,
          broker:           'Upstox',
        };
      });
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox orders');
  }

  async placeOrder(token: string, order: OrderRequest): Promise<OrderResponse> {
    try {
      const orderType = order.order_type.toUpperCase();
      const validity  = (order.validity ?? 'DAY').toUpperCase();

      const payload: Record<string, any> = {
        quantity:           order.quantity,
        product:            order.product.toUpperCase() === 'INTRADAY' ? 'I' : 'D',
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

  // ── squareOff ──────────────────────────────────────────────────────────────
  async squareOff(token: string, req: SquareOffRequest): Promise<OrderResponse> {
    try {
      const instrumentToken = req.instrument_token
        ?? (req.symbol.includes('|') ? req.symbol : `NSE_EQ|${req.symbol}`);

      const productCode = (() => {
        const p = req.product?.toUpperCase();
        if (p === 'MIS')  return 'I';
        if (p === 'CNC')  return 'D';
        if (p === 'NRML') return 'M';
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
      return {
        success: false,
        error: data.errors?.[0]?.message || 'Upstox square off failed',
        raw_response: data,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Upstox API Error', raw_response: {} };
    }
  }

  // ── convertPosition ────────────────────────────────────────────────────────
  async convertPosition(
    token: string,
    req: ConvertPositionRequest
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const instrumentToken = req.instrument_token
        ?? (req.symbol.includes('|') ? req.symbol : `NSE_EQ|${req.symbol}`);

      const mapProduct = (p: string) => {
        const up = p?.toUpperCase();
        if (up === 'MIS')  return 'I';
        if (up === 'CNC')  return 'D';
        if (up === 'NRML') return 'M';
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

      const response = await fetch('https://api.upstox.com/v2/order/convert-position', {
        method:  'PUT',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify(payload),
      });

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

  async getHistoricalCandles(
    instrumentKey: string,
    interval: '1minute' | 'day' | '30minute' | 'month' = 'day',
    fromDate: string,
    toDate: string
  ): Promise<any[]> {
    const endpoint = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`Upstox HTTP error: ${response.status}`);
    const data = await response.json();
    if (data.status === 'success' && data.data?.candles) return data.data.candles;
    return [];
  }
}