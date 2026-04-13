import { BrokerService, Holding, OrderRequest, OrderResponse } from './types';

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
      return data.data.map((h: any) => ({
        symbol: h.trading_symbol,
        quantity: h.quantity,
        average_price: h.average_price,
        current_price: h.last_price,
        broker: 'Upstox'
      }));
    }
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch Upstox holdings');
  }

  async placeOrder(token: string, order: OrderRequest): Promise<OrderResponse> {
    try {
      const response = await fetch("https://api.upstox.com/v2/order/place", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`, 
          "Content-Type": "application/json", 
          "Accept": "application/json" 
        },
        body: JSON.stringify({
          quantity: order.quantity,
          product: order.product.toUpperCase() === 'INTRADAY' ? 'I' : 'D',
          validity: 'DAY',
          price: order.price || 0,
          tag: 'AAPA_APP',
          instrument_token: order.symbol.includes('|') ? order.symbol : `NSE_EQ|${order.symbol}`,
          order_type: order.order_type.toUpperCase(),
          transaction_type: order.type.toUpperCase(),
          disclosed_quantity: 0,
          trigger_price: 0,
          is_amo: false
        })
      });
      const data = await response.json();

      if (data.status === 'success') {
        return { success: true, order_id: data.data.order_id, raw_response: data };
      }
      return { success: false, error: data.errors?.[0]?.message || "Upstox order failed", raw_response: data };
    } catch (e: any) {
      return { success: false, error: e.message || "Upstox API Error", raw_response: { error: e.message } };
    }
  }
}