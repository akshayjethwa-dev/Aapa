export interface OrderRequest {
  symbol:         string;
  type:           string;
  order_type:     string;
  validity?:      string;
  quantity:       number;
  price?:         number;
  trigger_price?: number;
  product:        string;
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
  symbol:            string;
  product:           string;
  quantity:          number;
  avg_price:         number;        // ← ADD: canonical frontend field
  average_price:     number;        // ← KEEP: legacy compatibility
  ltp:               number;        // ← ADD: last traded price
  current_price:     number;
  close_price:       number;
  pnl:               number;        // ← ADD: unrealised P&L
  day_pnl:           number;        // ← ADD: day P&L
  day_change:        number;
  day_change_pct:    number;
  segment:           string;        // ← ADD: EQ | FO | CD
  instrument_token?: string;
  broker:            string;
}

export interface OrderResponse {
  success:       boolean;
  order_id?:     string;
  error?:        string;
  raw_response?: any;
}

// ── NEW ──────────────────────────────────────────────────────────────────────
export interface SquareOffRequest {
  symbol:            string;
  product:           string;
  quantity:          number;
  instrument_token?: string;
}

export interface ConvertPositionRequest {
  symbol:            string;
  from_product:      string;
  to_product:        string;
  quantity:          number;
  instrument_token?: string;
}

export interface BrokerService {
  getFunds(token: string): Promise<number>;
  getHoldings(token: string): Promise<Holding[]>;
  getPositions(token: string): Promise<BrokerPosition[]>;
  placeOrder(token: string, order: OrderRequest): Promise<OrderResponse>;
  getOrders?(token: string): Promise<any[]>;
  // ── NEW ──
  squareOff?(token: string, req: SquareOffRequest): Promise<OrderResponse>;
  convertPosition?(token: string, req: ConvertPositionRequest): Promise<{ success: boolean; message?: string }>;
}