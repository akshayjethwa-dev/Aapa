// src/lib/brokers/websocket.ts
import * as protobuf from 'protobufjs';
import { useMarketDataStore } from '../../store/marketDataStore';
import { apiClient } from '../../api/client';

const MAX_SYMBOLS = 100;
const PROTO_URL = '/MarketDataFeed.proto';

export class UpstoxWebSocketClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private currentSubscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private protoRoot: protobuf.Root | null = null;
  private intentionalDisconnect: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private static instance: UpstoxWebSocketClient;
  private constructor() {}

  public static getInstance(): UpstoxWebSocketClient {
    if (!UpstoxWebSocketClient.instance) {
      UpstoxWebSocketClient.instance = new UpstoxWebSocketClient();
    }
    return UpstoxWebSocketClient.instance;
  }

  /**
   * Connect to Upstox market data WebSocket.
   * The token parameter is NO LONGER USED for Upstox auth —
   * the server reads it from DB. It's kept as optional for API compatibility.
   */
  public async connect(_token?: string) {
    this.intentionalDisconnect = false;

    if (this.isConnected || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      // 1. Load Protobuf schema if not already loaded
      if (!this.protoRoot) {
        this.protoRoot = await protobuf.load(PROTO_URL);
      }

      // 2. ✅ FIX: Call YOUR server proxy instead of Upstox directly.
      //    The server reads the encrypted token from DB and proxies the auth.
      const authRes = await apiClient.get('/api/broker/upstox/ws-auth');
      const wsUrl: string = authRes.data?.wsUrl;

      if (!wsUrl) {
        throw new Error('No WebSocket URL returned from auth proxy');
      }

      // 3. Connect to Upstox WebSocket
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen    = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose   = this.handleClose.bind(this);
      this.ws.onerror   = this.handleError.bind(this);

    } catch (error: any) {
      // If Upstox token expired, notify the app — don't keep retrying
      if (error?.response?.data?.code === 'UPSTOX_TOKEN_EXPIRED') {
        console.warn('[Upstox WS] Token expired. User must reconnect Upstox.');
        // Dispatch a custom event so the UI can show a reconnect prompt
        window.dispatchEvent(new CustomEvent('upstox:session-expired'));
        return; // Do NOT trigger reconnect — it will always fail until user re-auths
      }
      console.error('[Upstox WS] Connection error:', error?.message || error);
      this.triggerReconnect();
    }
  }

  public disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.currentSubscriptions.clear();
  }

  public subscribe(instrumentKeys: string[], mode: 'full' | 'ltpc' = 'full') {
    if (!this.isConnected || !this.ws) {
      instrumentKeys.forEach(k => this.currentSubscriptions.add(k));
      return;
    }

    const newSubs = instrumentKeys.filter(k => !this.currentSubscriptions.has(k));
    if (newSubs.length === 0) return;

    if (this.currentSubscriptions.size + newSubs.length > MAX_SYMBOLS) {
      console.warn(`[Upstox WS] Exceeded max ${MAX_SYMBOLS} symbols.`);
      return;
    }

    newSubs.forEach(k => this.currentSubscriptions.add(k));
    this.sendSubscriptionData(Array.from(this.currentSubscriptions), mode);
  }

  public unsubscribe(instrumentKeys: string[]) {
    instrumentKeys.forEach(k => this.currentSubscriptions.delete(k));
    if (this.isConnected) {
      this.sendSubscriptionData(Array.from(this.currentSubscriptions), 'full');
    }
  }

  private sendSubscriptionData(instrumentKeys: string[], mode: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      guid: crypto.randomUUID(),
      method: 'sub',
      data: { mode, instrumentKeys },
    };
    this.ws.send(new TextEncoder().encode(JSON.stringify(payload)));
  }

  private handleOpen() {
    console.log('[Upstox WS] ✅ Connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    if (this.currentSubscriptions.size > 0) {
      this.sendSubscriptionData(Array.from(this.currentSubscriptions), 'full');
    }
  }

  private async handleMessage(event: MessageEvent) {
    if (!this.protoRoot || !(event.data instanceof ArrayBuffer)) return;

    try {
      const buffer = new Uint8Array(event.data);
      const FeedResponse = this.protoRoot.lookupType(
        'com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse'
      );
      const decoded = FeedResponse.toObject(FeedResponse.decode(buffer), {
        enums: String, longs: Number, defaults: true,
      });

      if (decoded.feeds) {
        const batchUpdates: Record<string, any> = {};
        Object.entries(decoded.feeds).forEach(([key, feed]: [string, any]) => {
          const tickData: any = {};
          const ltpc = feed.fullFeed?.marketFF?.ltpc || feed.fullFeed?.indexFF?.ltpc || feed.ltpc;
          if (ltpc) { tickData.ltp = ltpc.ltp; tickData.close = ltpc.cp; }

          const marketLevel = feed.fullFeed?.marketFF?.marketLevel;
          if (marketLevel?.bidAskQuote?.length > 0) {
            const q = marketLevel.bidAskQuote[0];
            tickData.bidPrice = q.bidP; tickData.bidQty = q.bidQ;
            tickData.askPrice = q.askP; tickData.askQty = q.askQ;
          }
          if (feed.fullFeed?.marketFF?.vtt) tickData.volume = feed.fullFeed.marketFF.vtt;
          if (Object.keys(tickData).length > 0) batchUpdates[key] = tickData;
        });

        if (Object.keys(batchUpdates).length > 0) {
          useMarketDataStore.getState().updateMultipleTicks(batchUpdates);
        }
      }
    } catch (err) {
      console.error('[Upstox WS] Decode error:', err);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('[Upstox WS] Disconnected:', event.reason);
    this.isConnected = false;
    this.triggerReconnect();
  }

  private handleError(error: Event) {
    console.error('[Upstox WS] Error:', error);
  }

  private triggerReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Upstox WS] Stopped reconnecting.');
      return;
    }
    this.reconnectAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[Upstox WS] Reconnect in ${backoff}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), backoff);
  }
}

export const wsClient = UpstoxWebSocketClient.getInstance();