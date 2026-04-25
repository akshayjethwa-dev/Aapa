import * as protobuf from 'protobufjs';
import { useMarketDataStore } from '../../store/marketDataStore';

const MAX_SYMBOLS = 100;
const PROTO_URL = '/MarketDataFeed.proto';

export class UpstoxWebSocketClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private currentSubscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private accessToken: string | null = null;
  private protoRoot: protobuf.Root | null = null;
  private intentionalDisconnect: boolean = false;

  private static instance: UpstoxWebSocketClient;

  private constructor() {}

  public static getInstance(): UpstoxWebSocketClient {
    if (!UpstoxWebSocketClient.instance) {
      UpstoxWebSocketClient.instance = new UpstoxWebSocketClient();
    }
    return UpstoxWebSocketClient.instance;
  }

  /**
   * Initialize Protobuf and connect to the WebSocket
   */
  public async connect(token: string) {
    this.accessToken = token;
    this.intentionalDisconnect = false;

    if (this.isConnected || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      // 1. Load Protobuf schema if not already loaded
      if (!this.protoRoot) {
        this.protoRoot = await protobuf.load(PROTO_URL);
      }

      // 2. Get Authorized WebSocket URI from Upstox
      const response = await fetch('https://api.upstox.com/v2/feed/market-data-feed/authorize', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      const authData = await response.json();
      if (authData.status !== 'success') {
        throw new Error(authData.errors?.[0]?.message || 'Failed to authorize WS feed');
      }

      const wsUrl = authData.data.authorized_redirect_uri;

      // 3. Connect to WebSocket
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer'; // Crucial for Protobuf

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('[Upstox WS] Connection error:', error);
      this.triggerReconnect();
    }
  }

  public disconnect() {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.currentSubscriptions.clear();
  }

  /**
   * Subscribe to new instrument keys (max 100 total)
   */
  public subscribe(instrumentKeys: string[], mode: 'full' | 'ltpc' = 'full') {
    if (!this.isConnected || !this.ws) {
      // Queue subscriptions if not connected yet
      instrumentKeys.forEach(k => this.currentSubscriptions.add(k));
      return;
    }

    const newSubs = instrumentKeys.filter(k => !this.currentSubscriptions.has(k));
    if (newSubs.length === 0) return;

    if (this.currentSubscriptions.size + newSubs.length > MAX_SYMBOLS) {
      console.warn(`[Upstox WS] Exceeded max ${MAX_SYMBOLS} symbols. Ignoring excess.`);
      return;
    }

    newSubs.forEach(k => this.currentSubscriptions.add(k));
    this.sendSubscriptionData(Array.from(this.currentSubscriptions), mode);
  }

  /**
   * Unsubscribe from instrument keys
   */
  public unsubscribe(instrumentKeys: string[]) {
    instrumentKeys.forEach(k => this.currentSubscriptions.delete(k));
    if (this.isConnected) {
      // Re-send the complete active list to overwrite previous subscriptions
      this.sendSubscriptionData(Array.from(this.currentSubscriptions), 'full');
    }
  }

  private sendSubscriptionData(instrumentKeys: string[], mode: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      guid: crypto.randomUUID(),
      method: "sub",
      data: {
        mode: mode,
        instrumentKeys: instrumentKeys
      }
    };
    this.ws.send(Buffer.from(JSON.stringify(payload)));
  }

  private handleOpen() {
    console.log('[Upstox WS] Connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Resubscribe to previous keys on successful connection
    if (this.currentSubscriptions.size > 0) {
      this.sendSubscriptionData(Array.from(this.currentSubscriptions), 'full');
    }
  }

  private async handleMessage(event: MessageEvent) {
    if (!this.protoRoot) return;

    try {
      const buffer = new Uint8Array(event.data);
      const FeedResponse = this.protoRoot.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");
      const message = FeedResponse.decode(buffer);
      const decoded = FeedResponse.toObject(message, { enums: String, longs: Number, defaults: true });

      if (decoded.feeds) {
        const batchUpdates: Record<string, any> = {};

        // Parse Protobuf payload into our store format
        Object.entries(decoded.feeds).forEach(([key, feed]: [string, any]) => {
          let tickData: any = {};

          // Extract LTP Data
          const ltpc = feed.fullFeed?.marketFF?.ltpc || feed.fullFeed?.indexFF?.ltpc || feed.ltpc;
          if (ltpc) {
            tickData.ltp = ltpc.ltp;
            tickData.close = ltpc.cp;
          }

          // Extract Market Level (Bid/Ask) Data
          const marketLevel = feed.fullFeed?.marketFF?.marketLevel;
          if (marketLevel?.bidAskQuote?.length > 0) {
            const topQuote = marketLevel.bidAskQuote[0];
            tickData.bidPrice = topQuote.bidP;
            tickData.bidQty = topQuote.bidQ;
            tickData.askPrice = topQuote.askP;
            tickData.askQty = topQuote.askQ;
          }

          // Extract Volume
          if (feed.fullFeed?.marketFF?.vtt) {
             tickData.volume = feed.fullFeed.marketFF.vtt;
          }

          if (Object.keys(tickData).length > 0) {
            batchUpdates[key] = tickData;
          }
        });

        // Dispatch to Zustand store
        if (Object.keys(batchUpdates).length > 0) {
          useMarketDataStore.getState().updateMultipleTicks(batchUpdates);
        }
      }
    } catch (err) {
      console.error('[Upstox WS] Message decode error:', err);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('[Upstox WS] Disconnected', event.reason);
    this.isConnected = false;
    this.triggerReconnect();
  }

  private handleError(error: Event) {
    console.error('[Upstox WS] Error:', error);
  }

  private triggerReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Upstox WS] Max retries reached or intentional disconnect.');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`[Upstox WS] Reconnecting in ${backoffTime}ms (Attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (this.accessToken) this.connect(this.accessToken);
    }, backoffTime);
  }
}

export const wsClient = UpstoxWebSocketClient.getInstance();