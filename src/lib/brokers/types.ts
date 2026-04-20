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
  close_price: number; 
  day_change: number;     // NEW
  day_change_pct: number; // NEW
  broker: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  close_price: number; 
  day_change: number;     // NEW
  day_change_pct: number; // NEW
  product: string;
  broker: string;
}

export interface OrderResponse {
  success: boolean;
  order_id?: string;
  error?: string;
  raw_response?: any;
}

export interface BrokerService {
  getFunds(token: string): Promise<number>;
  getHoldings(token: string): Promise<Holding[]>;
  getPositions(token: string): Promise<BrokerPosition[]>;
  placeOrder(token: string, order: OrderRequest): Promise<OrderResponse>;
  getOrders?(token: string): Promise<any[]>;
}