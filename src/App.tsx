/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { formatCurrency, cn } from './lib/utils';
import { apiClient } from './api/client';

// ✅ NEW: import existing constant — no manual list needed
import { INDEX_CONSTITUENTS } from './constants/marketData';

import Navbar from './components/Navbar';
import Header from './components/Header';

import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import Market from './screens/Market';
import Portfolio from './screens/Portfolio';
import Positions from './screens/Positions';
import More from './screens/More';
import AdminPanel from './screens/admin/AdminPanel';
import ComplianceDetail from './screens/ComplianceDetail';

import KycVerification from './screens/KycVerification';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RiskDisclosure from './pages/RiskDisclosure';

import IndexOverview from './screens/IndexOverview';
import IndexDetail from './screens/IndexDetail';
import OrderWindow from './screens/OrderWindow';
import FOTradingCenter from './screens/FOTradingCenter';
import FullChartModal from './components/FullChartModal';
import OptionChain from './components/OptionChain';
import Orders from './screens/Orders';

import SymbolSearch from './components/SymbolSearch';
import StockDetail from './screens/StockDetail';

export type MarketPhase = 'LIVE' | 'PRE_OPEN' | 'CLOSED';

// ✅ NEW: Derive the full tradeable stock universe from INDEX_CONSTITUENTS.
// This is always in sync with marketData.ts — no manual list to maintain.
const ALL_STOCK_SYMBOLS: string[] = Array.from(
  new Set(Object.values(INDEX_CONSTITUENTS).flat())
);

// Seed helper: creates a structured empty stub so getPriceData
// can distinguish it from a bare number (bare numbers always give changePct=0).
// ltp=0 stubs are filtered out by the gainers/losers guard until real data arrives.
const makeEmptyStub = () => ({ ltp: 0, close: 0, day_change: 0, day_change_pct: 0 });

function App() {
  const { token, user, setAuth, logout, setIsWsConnected } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  // ✅ NEW: Initial state built dynamically from INDEX_CONSTITUENTS.
  // All index + stock symbols get an empty stub — ltp=0 means they are
  // invisible to gainers/losers until the snapshot/WS fills them in.
  const [stocks, setStocks] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    // Add index stubs (used by index scroller)
    const indices = [
      'NIFTY 50', 'SENSEX', 'BANKNIFTY', 'FINNIFTY',
      'MIDCAP NIFTY', 'SMALLCAP NIFTY',
      'NIFTY IT', 'NIFTY AUTO', 'NIFTY PHARMA',
      'NIFTY METAL', 'NIFTY FMCG', 'NIFTY REALTY',
    ];
    indices.forEach(idx => { initial[idx] = makeEmptyStub(); });
    // Add all constituent stocks from INDEX_CONSTITUENTS
    ALL_STOCK_SYMBOLS.forEach(sym => { initial[sym] = makeEmptyStub(); });
    return initial;
  });

  const [complianceType, setComplianceType] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [overviewIndex, setOverviewIndex] = useState<string | null>(null);
  const [orderConfig, setOrderConfig] = useState<any>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedStockFromSearch, setSelectedStockFromSearch] = useState<string | null>(null);

  const [marketPhase, setMarketPhase] = useState<MarketPhase>('CLOSED');

  const [isConnectingUptox, setIsConnectingUptox] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // =========================================================================
  // ✅ NEW: Seed stocks map with real last-close prices on mount.
  // Uses the existing /api/market/refresh endpoint (same as handleForceRefresh).
  // Runs once when the user is authenticated. WS ticker will overwrite
  // with live prices once the market opens.
  // =========================================================================
  useEffect(() => {
    if (!token) return;
    const seedStocksFromSnapshot = async () => {
      try {
        const res = await apiClient.post('/api/market/refresh');
        if (res.data?.last_prices && typeof res.data.last_prices === 'object') {
          setStocks(prev => ({
            ...prev,                   // keep stubs for any symbol not in snapshot
            ...res.data.last_prices,   // overwrite with real structured quote objects
          }));
        }
      } catch {
        // silent — WS will fill in live data once market opens
      }
    };
    seedStocksFromSnapshot();
  }, [token]);

  // =========================================================================
  // HELPER: Determine if onboarding is complete
  // =========================================================================
  const isOnboardingComplete = Boolean(
    user &&
      user.role !== 'admin' &&
      (user.is_onboarding_complete === true || (user.onboarding_step ?? 0) >= 4),
  );

  // =========================================================================
  // UPSTOX CONNECTION TRIGGER
  // =========================================================================
  const handleConnectUptox = async () => {
    if (!token) return toast.error('Please log in first');

    setIsConnectingUptox(true);
    try {
      const res = await apiClient.get('/api/auth/uptox/url');
      const data = res.data;

      if (data.url) {
        const width = 500;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
          data.url,
          'UpstoxLogin',
          `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
        );
      } else {
        toast.error('Failed to generate Upstox login URL');
        setIsConnectingUptox(false);
      }
    } catch (err: any) {
      console.error('Upstox connection error:', err);
      toast.error(err.response?.data?.error || 'Failed to start connection');
      setIsConnectingUptox(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.post('/api/market/refresh');
      if (res.data.success) {
        setStocks(res.data.last_prices || stocks);
        const debugRes = await apiClient.get('/api/market-status');
        setDebugInfo(debugRes.data);
      }
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchDebug = async () => {
      try {
        const res = await apiClient.get('/api/market-status');
        setDebugInfo(res.data);
      } catch (e) {
        // ignore
      }
    };
    if (activeTab === 'more') fetchDebug();
  }, [activeTab]);

  // =========================================================================
  // TAB ROUTING LOGIC — Onboarding gate
  // =========================================================================
  useEffect(() => {
    if (token && user) {
      if (user.role === 'admin') {
        if (activeTab === 'dashboard') setActiveTab('admin');
        return;
      }

      if (!isOnboardingComplete) {
        if (activeTab !== 'onboarding') {
          setActiveTab('onboarding');
        }
        return;
      }

      if (!user.is_uptox_connected && activeTab !== 'kyc' && activeTab !== 'more') {
        // soft guidance only
      }

      if (activeTab === 'onboarding') {
        setActiveTab('dashboard');
      }
    }
  }, [token, user, activeTab, isOnboardingComplete]);

  const openOptionChain = (index: string = 'NIFTY 50') => {
    setSelectedIndex(index);
  };

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) return;
      try {
        const res = await apiClient.get('/api/user/profile');
        if (!res.data.id) {
          logout();
        } else {
          setAuth(res.data, token);
        }
      } catch (e: any) {
        if (
          e.response?.status === 401 ||
          e.response?.status === 403 ||
          e.response?.status === 404
        ) {
          logout();
        }
      }
    };
    verifyToken();
  }, [token, logout, setAuth]);

  // =========================================================================
  // GLOBAL MESSAGE LISTENER FOR OAUTH CALLBACK
  // =========================================================================
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [window.location.origin, import.meta.env.VITE_APP_URL];

      if (!allowedOrigins.includes(event.origin)) return;

      const data = event.data;

      if (data?.type === 'UPTOX_AUTH_SUCCESS') {
        try {
          const { token: uptoxToken, refresh_token: uptoxRefreshToken } = data;

          if (uptoxToken) {
            await apiClient.post('/api/auth/uptox/save-token', {
              access_token: uptoxToken,
              refresh_token: uptoxRefreshToken || '',
            });
          }

          await new Promise((r) => setTimeout(r, 600));

          const profileRes = await apiClient.get('/api/user/profile');
          if (profileRes.data?.id) {
            setAuth(profileRes.data, token as string);
            toast.success('Successfully connected to Upstox! Live data is now active.');
          }
        } catch (e) {
          console.error('Failed to finalize Upstox connection', e);
          toast.error('Failed to finalize Upstox connection. Please try again.');
        } finally {
          setIsConnectingUptox(false);
        }
      } else if (data?.type === 'UPTOX_AUTH_ERROR') {
        toast.error(data.error?.message || 'Upstox connection failed or was cancelled.');
        setIsConnectingUptox(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, setAuth]);

  // =========================================================================
  // GLOBAL WEBSOCKET CONNECTION
  // =========================================================================
  useEffect(() => {
    if (!token) return;

    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      const freshToken = localStorage.getItem('token') || token;
      if (!freshToken) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/?token=${freshToken}`);

      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted) return;
        setIsWsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'broker_disconnected') {
            if (message.broker === 'upstox') {
              toast.error('Upstox session expired. Please reconnect.');
              apiClient
                .get('/api/user/profile')
                .then((res) => {
                  if (isComponentMounted && res.data?.id) {
                    setAuth(res.data, freshToken);
                  }
                })
                .catch(console.error);
            }
          }

          if (message.type === 'ticker') {
            setStocks(message.data);
            if (message.marketPhase) {
              setMarketPhase(message.marketPhase as MarketPhase);
            }
          }

          if (message.type === 'order_update') {
            const rawStatus = message.data.status ? String(message.data.status).toLowerCase() : 'updated';
            const symbol = message.data.trading_symbol || 'Order';
            const orderId = message.data.order_id;
            const messageTxt = message.data.status_message;

            if (rawStatus === 'complete' || rawStatus === 'completed') {
              toast.success(`Success: Order Filled`, {
                description: `${symbol} - Order ID: ${orderId}`,
              });
            } else if (rawStatus === 'rejected') {
              toast.error(`Order Rejected: ${symbol}`, {
                description: messageTxt || `Order ID: ${orderId} was rejected.`,
              });
            } else if (rawStatus === 'cancelled') {
              toast.info(`Order Cancelled: ${symbol}`, {
                description: `Order ID: ${orderId} was cancelled.`,
              });
            } else {
              toast.info(`Order Updated: ${symbol}`, {
                description: `Status: ${rawStatus.toUpperCase()}`,
              });
            }

            apiClient
              .get('/api/user/profile')
              .then((res) => {
                if (res.data?.id && isComponentMounted) {
                  setAuth(res.data, freshToken);
                }
              })
              .catch(console.error);

            window.dispatchEvent(new CustomEvent('broker_portfolio_updated', { detail: message.data }));
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!isComponentMounted) return;
        setIsWsConnected(false);
        const backoffTime = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000,
        );
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, backoffTime);
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [token, setAuth, setIsWsConnected]);

  // =========================================================================
  // Symbol search selection handler
  // =========================================================================
  const handleSymbolSelected = (symbolMeta: { name: string; type: string; [key: string]: any }) => {
    setIsSearchOpen(false);

    if (symbolMeta.type === 'INDEX') {
      setSelectedIndex(symbolMeta.name);
      return;
    }

    setSelectedStockFromSearch(symbolMeta.name);
    setActiveTab('market');
  };

  // =========================================================================
  // Snapshot Resolver Handler
  // =========================================================================
  const handleSnapshotResolved = useCallback((sym: string, quote: any) => {
    setStocks((prev) => ({
      ...prev,
      [sym]: { ...quote },
    }));
  }, []);

  const pathname = window.location.pathname;
  if (pathname === '/terms') return <TermsOfService />;
  if (pathname === '/privacy') return <PrivacyPolicy />;
  if (pathname === '/risk-disclosure') return <RiskDisclosure />;

  if (!token) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-center" richColors />

      {isOnboardingComplete && (
        <Header
          onProfileClick={() => setActiveTab('more')}
          onSearchClick={() => setIsSearchOpen(true)}
        />
      )}

      <main
        className={cn(
          'max-w-md mx-auto',
          isOnboardingComplete ? 'pt-20 pb-24' : 'pt-0 pb-0',
        )}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'onboarding' && (
            <Onboarding
              key="onboarding"
              onComplete={() => setActiveTab('dashboard')}
              onConnectUpstox={handleConnectUptox}
              isConnectingUpstox={isConnectingUptox}
            />
          )}

          {isOnboardingComplete && (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  key="dashboard"
                  stocks={stocks}
                  marketPhase={marketPhase}
                  onMarketClick={() => setActiveTab('market')}
                  onIndexClick={setSelectedIndex}
                  onProfileClick={() => setActiveTab('more')}
                />
              )}
              {activeTab === 'market' && (
                <Market
                  key="market"
                  stocks={stocks}
                  marketPhase={marketPhase}
                  onIndexClick={setOverviewIndex}
                  onPlaceOrder={setOrderConfig}
                  initialSelectedStock={selectedStockFromSearch}
                  onSnapshotResolved={handleSnapshotResolved}
                />
              )}
              {activeTab === 'fo' && (
                <div className="space-y-6">
                  <OptionChain
                    onPlaceOrder={setOrderConfig}
                    stocks={stocks}
                    fullChain={false}
                  />
                  <FOTradingCenter
                    key="fo"
                    stocks={stocks}
                    onOpenOptionChain={() => openOptionChain()}
                    onConnectUptox={handleConnectUptox}
                    isConnectingUptox={isConnectingUptox}
                  />
                </div>
              )}
              {activeTab === 'positions' && (
                <Positions key="positions" stocks={stocks} />
              )}
              {activeTab === 'portfolio' && (
                <Portfolio key="portfolio" />
              )}
              {activeTab === 'orders' && (
                <Orders key="orders" onBack={() => setActiveTab('more')} />
              )}
              {activeTab === 'admin' && user?.role === 'admin' && (
                <AdminPanel key="admin" onBack={() => setActiveTab('dashboard')} />
              )}
              {activeTab === 'more' && (
                <More
                  key="more"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  setComplianceType={setComplianceType}
                  setStocks={setStocks}
                  onConnectUptox={handleConnectUptox}
                  isConnectingUptox={isConnectingUptox}
                  debugInfo={debugInfo}
                  isRefreshing={isRefreshing}
                  onForceRefresh={handleForceRefresh}
                />
              )}
              {activeTab === 'compliance' && (
                <ComplianceDetail
                  key="compliance"
                  type={complianceType}
                  onBack={() => setActiveTab('more')}
                />
              )}
              {activeTab === 'kyc' && (
                <KycVerification
                  key="kyc"
                  onConnectUptox={handleConnectUptox}
                  isConnectingUptox={isConnectingUptox}
                />
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      {isOnboardingComplete && (
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Overlays / modals */}
      <AnimatePresence mode="wait">
        {isSearchOpen && (
          <SymbolSearch
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            stocks={stocks}
            onSelect={handleSymbolSelected}
          />
        )}

        {orderConfig && (
          <OrderWindow
            key="order-window"
            config={orderConfig}
            onClose={() => setOrderConfig(null)}
            onOrderPlaced={() => {}}
            onKycRequired={() => {
              setOrderConfig(null);
              setActiveTab('kyc');
            }}
          />
        )}
        {overviewIndex && (
          <IndexOverview
            key="index-overview"
            indexName={overviewIndex}
            stocks={stocks}
            onClose={() => setOverviewIndex(null)}
            onOpenOptionChain={() => {
              setSelectedIndex(overviewIndex);
              setOverviewIndex(null);
            }}
          />
        )}
        {selectedIndex && (
          <IndexDetail
            key="index-detail"
            indexName={selectedIndex}
            stocks={stocks}
            onClose={() => setSelectedIndex(null)}
            onPlaceOrder={setOrderConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;