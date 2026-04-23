// src/lib/brokers/types.ts
export interface OrderRequest {
  symbol:        string;
  type:          string;            // BUY | SELL
  order_type:    string;            // MARKET | LIMIT | SL | SL-M
  validity?:     string;            // DAY | IOC  ← NEW
  quantity:      number;
  price?:        number;
  trigger_price?: number;           // Required for SL / SL-M  ← NEW
  product:       string;            // I (intraday) | D (delivery)
}

export interface Holding {
  symbol:         string;
  quantity:       number;
  average_price:  number;
  current_price:  number;
  close_price:    number;
  day_change:     number;
  day_change_pct: number;
  broker:         string;
}

export interface BrokerPosition {
  symbol:         string;
  quantity:       number;
  average_price:  number;
  current_price:  number;
  close_price:    number;
  day_change:     number;
  day_change_pct: number;
  product:        string;
  broker:         string;
}

export interface OrderResponse {
  success:       boolean;
  order_id?:     string;
  error?:        string;
  raw_response?: any;
}

export interface BrokerService {
  getFunds(token: string): Promise<number>;
  getHoldings(token: string): Promise<Holding[]>;
  getPositions(token: string): Promise<BrokerPosition[]>;
  placeOrder(token: string, order: OrderRequest): Promise<OrderResponse>;
  getOrders?(token: string): Promise<any[]>;
}