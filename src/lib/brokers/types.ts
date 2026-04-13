export interface OrderRequest {
  symbol: string;
  type: string; // BUY or SELL
  order_type: string; // MARKET, LIMIT, SL
  quantity: number;
  price?: number;
  product: string; // INTRADAY, DELIVERY
}

export interface Holding {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  broker: string;
}

export interface OrderResponse {
  success: boolean;
  order_id?: string;
  error?: string;
  raw_response?: any; // Useful for storing audit logs in the DB
}

export interface BrokerService {
  getFunds(token: string): Promise<number>;
  getHoldings(token: string): Promise<Holding[]>;
  placeOrder(token: string, order: OrderRequest): Promise<OrderResponse>;
}