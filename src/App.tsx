/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronRight, Search, AlertCircle } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { formatCurrency } from './lib/utils';
import { apiClient } from './api/client';

// Layout Components
import Navbar from './components/Navbar';
import Header from './components/Header';

// Screen Components
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import Market from './screens/Market';
import Portfolio from './screens/Portfolio';
import More from './screens/More';
import AdminPanel from './screens/admin/AdminPanel';
import ComplianceDetail from './screens/ComplianceDetail';

// --- ADDED FOR TASK-013: KYC Screen ---
import KycVerification from './screens/KycVerification';

// --- ADDED FOR TASK-014: Legal Pages ---
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RiskDisclosure from './pages/RiskDisclosure';

// Modal / Overlay Components
import IndexOverview from './screens/IndexOverview';
import IndexDetail from './screens/IndexDetail';
import OrderWindow from './screens/OrderWindow';
import FOTradingCenter from './screens/FOTradingCenter';
import FullChartModal from './components/FullChartModal';
import OptionChain from './components/OptionChain';

// --- Main App ---

function App() {
  const { token, user, setAuth, logout, setIsWsConnected, refreshUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stocks, setStocks] = useState<Record<string, number>>({
    "NIFTY 50": 22145.20,
    "SENSEX": 72850.40,
    "BANKNIFTY": 46800.15,
    "FINNIFTY": 20850.60,
    "RELIANCE": 2985.40,
    "TCS": 4120.15,
    "HDFCBANK": 1450.60,
    "INFY": 1680.40,
    "ICICIBANK": 1050.20
  });
  const [complianceType, setComplianceType] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [overviewIndex, setOverviewIndex] = useState<string | null>(null);
  const [orderConfig, setOrderConfig] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStockFromSearch, setSelectedStockFromSearch] = useState<string | null>(null);

  const [isDemoMode, setIsDemoMode] = useState(false); 

  // Broker Connection Logic
  const [isConnectingAngel, setIsConnectingAngel] = useState(false);
  const [isConnectingUptox, setIsConnectingUptox] = useState(false);
  const [angelForm, setAngelForm] = useState({ clientCode: '', password: '', totp: '' });
  const [showAngelLogin, setShowAngelLogin] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- TASK 5.1: Reconnection Refs ---
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const handleConnectAngel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingAngel(true);
    try {
      await apiClient.post('/api/auth/angelone/login', angelForm);
      toast.success('Angel One connected successfully!');
      setShowAngelLogin(false);
      
      const pRes = await apiClient.get('/api/user/profile');
      setAuth(pRes.data, token as string);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Angel One login failed');
    } finally {
      setIsConnectingAngel(false);
    }
  };

  const handleConnectUptox = async () => {
    setIsConnectingUptox(true);
    const authWindow = window.open('about:blank', 'uptox_auth', 'width=500,height=600');
    try {
      const res = await apiClient.get('/api/auth/uptox/url');
      const { url, error } = res.data;
      if (url && authWindow) {
        authWindow.location.href = url;
      } else {
        authWindow?.close();
        toast.error(error || 'Uptox configuration missing on server');
      }
    } catch (e: any) {
      authWindow?.close();
      toast.error(e.response?.data?.error || 'Failed to get connection URL');
    } finally {
      setIsConnectingUptox(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.post('/api/market/refresh');
      if (res.data.success) {
        setStocks(res.data.last_prices);
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
      } catch (e) {}
    };
    if (activeTab === 'more') fetchDebug();
  }, [activeTab]);

  useEffect(() => {
    if (token && user?.role === 'admin' && activeTab === 'dashboard') {
      setActiveTab('admin');
    }
  }, [token, user?.role]);

  const openOptionChain = (index: string = 'NIFTY 50') => {
    setSelectedIndex(index);
  };

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return [];
    return Object.keys(stocks)
      .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 8);
  }, [searchQuery, stocks]);

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
        if (e.response?.status === 401 || e.response?.status === 404) {
          logout();
        }
      }
    };
    verifyToken();
  }, [token, logout, setAuth]);

    // Global Upstox Popup Listener — Single source of truth for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const isTrustedOrigin =
        event.origin.includes(window.location.hostname) ||
        event.origin === import.meta.env.VITE_APP_URL;

      if (!isTrustedOrigin) return;

      if (event.data?.type === 'UPTOX_AUTH_SUCCESS') {
        const { token: uptoxToken, refresh_token: uptoxRefreshToken } = event.data;
        if (!token) return;

        try {
          // Step 1: Save the Upstox OAuth token on the backend
          await apiClient.post('/api/auth/uptox/save-token', {
            access_token: uptoxToken,
            refresh_token: uptoxRefreshToken,
          });

          // Step 2: Small delay to ensure the server has committed the update
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Step 3: Re-fetch the user profile — this updates is_uptox_connected in store
          await refreshUser();

          toast.success('Upstox account connected successfully! Live data is now active.');
        } catch (e) {
          console.error('Failed to save Uptox token', e);
          toast.error('Failed to finalize Upstox connection. Please try again.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, refreshUser]);

  // ========================================================
  // --- UPDATED FOR TASK 5.1 & 6.1: WS Reconnection Logic ---
  // ========================================================
  useEffect(() => {
    if (!token) return;

    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;
      
      // Clean up existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      // --- BUG FIX: Fetch the freshest token directly from localStorage ---
      // Axios interceptors refresh the token every 15 mins in the background. 
      // We must grab it from storage so the WebSocket doesn't use an expired token.
      const freshToken = localStorage.getItem('token') || token;
      
      // Stop trying to connect if the user has completely logged out
      if (!freshToken) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/?token=${freshToken}`);
      
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted) return;
        console.log('[WebSocket] Connected securely with fresh token');
        setIsWsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'broker_disconnected') {
            if (message.broker === 'upstox' && user?.is_uptox_connected) {
              toast.error('Upstox session expired. Please reconnect.');
              setAuth({ ...user, is_uptox_connected: false }, token);
            }
          }

          if (message.type === 'ticker') {
            setStocks(message.data);
            if (message.isSimulated !== undefined) {
              setIsDemoMode(message.isSimulated);
            }
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message', e);
        }
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Connection error', err);
      };

      ws.onclose = () => {
        if (!isComponentMounted) return;
        console.log('[WebSocket] Disconnected');
        setIsWsConnected(false);

        // Exponential backoff logic: 1s, 2s, 4s, 8s... max 30s
        const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        
        console.log(`[WebSocket] Reconnecting in ${backoffTime / 1000} seconds...`);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, backoffTime);
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, user?.is_uptox_connected]);


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
      <Header
        onProfileClick={() => setActiveTab('more')}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <main className="max-w-md mx-auto pt-20">
        {isDemoMode && (
          <div className="bg-amber-500 text-black py-2 px-4 text-center font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 z-50 relative">
            <AlertCircle size={14} className="inline mr-2 -mt-0.5" />
            DEMO MODE - Prices are simulated. Connect broker to trade.
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard
              key="dashboard"
              stocks={stocks}
              onMarketClick={() => setActiveTab('market')}
              onIndexClick={setSelectedIndex}
              onProfileClick={() => setActiveTab('more')}
            />
          )}
          {activeTab === 'market' && (
            <Market
              key="market"
              stocks={stocks}
              onIndexClick={setOverviewIndex}
              onPlaceOrder={setOrderConfig}
              initialSelectedStock={selectedStockFromSearch}
            />
          )}
          {activeTab === 'fo' && (
            <div className="space-y-6">
              <OptionChain onPlaceOrder={setOrderConfig} stocks={stocks} fullChain={false} />
              <FOTradingCenter
                key="fo"
                stocks={stocks}
                onOpenOptionChain={() => openOptionChain()}
                onConnectAngel={() => setShowAngelLogin(true)}
                onConnectUptox={handleConnectUptox}
                isConnectingAngel={isConnectingAngel}
                isConnectingUptox={isConnectingUptox}
              />
            </div>
          )}
          {activeTab === 'portfolio' && <Portfolio key="portfolio" stocks={stocks} />}
          {activeTab === 'onboarding' && (
            <Onboarding key="onboarding" onComplete={() => setActiveTab('dashboard')} />
          )}
          {activeTab === 'admin' && (
            <AdminPanel key="admin" onBack={() => setActiveTab('dashboard')} />
          )}
          {activeTab === 'more' && (
            <More
              key="more"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setComplianceType={setComplianceType}
              setStocks={setStocks}
              onConnectAngel={() => setShowAngelLogin(true)}
              onConnectUptox={handleConnectUptox}
              isConnectingAngel={isConnectingAngel}
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
              onBack={() => setActiveTab('dashboard')}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Angel One Login Modal */}
      <AnimatePresence>
        {showAngelLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Angel One Login</h3>
                <button onClick={() => setShowAngelLogin(false)} className="p-2 text-zinc-500 hover:text-white">
                  <LogOut size={20} className="rotate-90" />
                </button>
              </div>
              <form onSubmit={handleConnectAngel} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Client Code</label>
                  <input
                    type="text"
                    required
                    value={angelForm.clientCode}
                    onChange={(e) => setAngelForm({ ...angelForm, clientCode: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="e.g. V123456"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={angelForm.password}
                    onChange={(e) => setAngelForm({ ...angelForm, password: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">TOTP / OTP</label>
                  <input
                    type="text"
                    required
                    value={angelForm.totp}
                    onChange={(e) => setAngelForm({ ...angelForm, totp: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 transition-colors"
                    placeholder="6-digit code"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isConnectingAngel}
                  className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isConnectingAngel ? 'Connecting...' : 'Link Account'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence mode="wait">
        {isSearchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-150 bg-black/95 backdrop-blur-xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-2 -ml-2 rounded-full hover:bg-zinc-900 text-zinc-400"
              >
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search Stocks, Indices, F&O..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((symbol: string) => (
                  <div
                    key={symbol}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSelectedStockFromSearch(symbol);
                      setActiveTab('market');
                    }}
                    className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center font-bold text-xs text-zinc-500">
                        {symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white tracking-tight">{symbol}</p>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase">NSE • Equity</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(stocks[symbol] || 0)}</p>
                      <p className="text-[10px] font-bold text-emerald-500">+1.24%</p>
                    </div>
                  </div>
                ))
              ) : searchQuery ? (
                <div className="text-center py-20">
                  <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">No results found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                    Recent Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {['RELIANCE', 'NIFTY 50', 'TCS', 'ZOMATO'].map(s => (
                      <button
                        key={s}
                        onClick={() => setSearchQuery(s)}
                        className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {orderConfig && (
          <OrderWindow
            key="order-window"
            config={orderConfig}
            onClose={() => setOrderConfig(null)}
            onOrderPlaced={() => {}}
            isDemoMode={isDemoMode}
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

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;