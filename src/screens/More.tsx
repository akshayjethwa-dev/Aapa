import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Settings, HelpCircle, FileText, LogOut, ShieldCheck, Bell, CreditCard, ChevronRight, ArrowLeft, Info, AlertTriangle, Activity, Wallet, Zap, Users, LayoutDashboard, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import ComplianceDetail from './ComplianceDetail';
import { apiClient } from '../api/client'; // <-- ADDED

const More = ({ 
  activeTab, 
  setActiveTab, 
  setComplianceType, 
  setStocks,
  onConnectUptox,
  isConnectingUptox,
  debugInfo,
  isRefreshing,
  onForceRefresh
}: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  setComplianceType: (t: string) => void, 
  setStocks: (s: Record<string, number>) => void,
  onConnectUptox: () => void,
  isConnectingUptox: boolean,
  debugInfo: any,
  isRefreshing: boolean,
  onForceRefresh: () => void
}) => {
  const { user, token, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        // FIX: Using apiClient to ensure token refresh works
        const res = await apiClient.get('/api/user/profile');
        const data = res.data;
        if (data.id) {
          setAuth(data, token);
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, [token]);

  const allSections = [
    {
      title: 'Debug Info (Internal)',
      items: [
        { 
          icon: Activity, 
          label: 'Market Data Status', 
          status: debugInfo?.is_fetching ? 'Active' : 'Idle', 
          color: debugInfo?.is_fetching ? 'text-emerald-500' : 'text-zinc-500' 
        },
        { 
          icon: ShieldCheck, 
          label: 'Tokens in DB', 
          status: `${debugInfo?.token_count || 0} users`, 
          color: 'text-zinc-500' 
        },
        {
          icon: ShieldCheck,
          label: 'API Key Configured',
          status: debugInfo?.api_key_set ? 'Yes' : 'No (Check .env)',
          color: debugInfo?.api_key_set ? 'text-emerald-500' : 'text-rose-500'
        },
        {
          icon: Info,
          label: 'Redirect URI',
          status: `${window.location.origin}/auth/callback`,
          color: 'text-zinc-500',
          copy: true
        },
        { 
          icon: Info, 
          label: 'Last NIFTY Price', 
          status: debugInfo?.last_prices?.['NIFTY 50'] || '0.00', 
          color: 'text-zinc-500' 
        },
        { 
          icon: History, 
          label: 'Force Refresh Data', 
          status: isRefreshing ? 'Refreshing...' : 'Click to Sync', 
          color: 'text-blue-500',
          action: onForceRefresh,
          loading: isRefreshing
        },
      ]
    },
    {
      title: 'Account',
      items: [
        { icon: UserIcon, label: 'Profile Details', status: 'Active', color: 'text-emerald-500' },
        { icon: History, label: 'Order History', status: '', color: 'text-blue-500', action: () => navigate('/orders') },
        { icon: ShieldCheck, label: 'KYC Status', status: 'Pending', color: 'text-amber-500', action: () => setActiveTab('onboarding') },
        { icon: Wallet, label: 'Funds & Withdrawals', status: '', color: 'text-blue-500' },
        { 
          icon: Zap, 
          label: 'Connect Upstox', 
          status: user?.is_uptox_connected ? 'Linked' : 'Not Linked', 
          color: user?.is_uptox_connected ? 'text-emerald-500' : 'text-zinc-500',
          action: user?.is_uptox_connected ? undefined : onConnectUptox,
          loading: isConnectingUptox
        },
      ]
    },
    {
      title: 'Subscription',
      items: [
        { icon: Zap, label: 'Membership Plans', status: 'Free', color: 'text-purple-500' },
        { icon: Users, label: 'Refer & Earn', status: '₹500/ref', color: 'text-pink-500' },
      ]
    },
    {
      title: 'Security & App',
      items: [
        { icon: Settings, label: 'App Settings', status: '', color: 'text-zinc-500' },
        { icon: ShieldCheck, label: 'Security Settings', status: '', color: 'text-zinc-500' },
        { icon: HelpCircle, label: 'Help & Support', status: '', color: 'text-zinc-500' },
        ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Admin Panel', status: 'Staff', color: 'text-rose-500', action: () => setActiveTab('admin') }] : []),
      ]
    },
    {
      title: 'Compliance',
      items: [
        { icon: Info, label: 'SEBI Disclaimer', status: '', color: 'text-zinc-600', action: () => { setComplianceType('SEBI Disclaimer'); setActiveTab('compliance'); } },
        { icon: AlertTriangle, label: 'Risk Disclosure', status: '', color: 'text-zinc-600', action: () => { setComplianceType('Risk Disclosure'); setActiveTab('compliance'); } },
        { icon: FileText, label: 'Terms & Conditions', status: '', color: 'text-zinc-600', action: () => { setComplianceType('Terms & Conditions'); setActiveTab('compliance'); } },
      ]
    }
  ];

  const sections = user?.role === 'admin' 
    ? allSections 
    : allSections
        .filter(s => ['Account', 'Subscription', 'Security & App', 'Compliance'].includes(s.title));

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col items-center text-center space-y-4 pt-10">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-linear-to-br from-emerald-500 to-emerald-900 p-1 shadow-2xl shadow-emerald-500/20">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
              <UserIcon size={40} className="text-zinc-800" />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full border-4 border-black flex items-center justify-center">
            <ShieldCheck size={12} className="text-black" strokeWidth={3} />
          </div>
        </div>
        <div>
          {/* FIX: Prevent UI crash by safely handling email */}
          <h2 className="text-xl font-bold tracking-tight">{(user?.email || '').split('@')[0] || 'Trader'}</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Client ID: AAPA-{user?.id}001</p>
        </div>
      </div>

      <div className="px-6 space-y-8">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map((item: any, iIdx: number) => (
                <button 
                  key={iIdx} 
                  onClick={item.action}
                  disabled={item.loading || (item.label === 'Connect Upstox' && user?.is_uptox_connected)}
                  className="w-full bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/30 rounded-2xl p-4 flex justify-between items-center transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-zinc-900/50", item.color)}>
                      {item.loading ? <Activity size={20} className="animate-pulse" /> : <item.icon size={20} />}
                    </div>
                    <span className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.status && (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate max-w-30", 
                        item.color
                      )}>
                        {item.status}
                      </span>
                    )}
                    {item.copy ? (
                      <div 
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.status);
                          toast.success('Copied to clipboard!');
                        }}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <FileText size={14} />
                      </div>
                    ) : !user?.is_uptox_connected && item.label === 'Connect Upstox' ? (
                      <div className="bg-emerald-500 text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Link</div>
                    ) : (
                      <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6">
        <button 
          onClick={logout}
          className="w-full bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-black border border-rose-500/10 font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>

      <div className="text-center opacity-30 pb-10">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Aapa Capital v1.0.0 • SEBI INZ000123456</p>
      </div>
    </div>
  );
};

export default More;