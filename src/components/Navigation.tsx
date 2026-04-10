import React from 'react';
import { LayoutDashboard, TrendingUp, Wallet, PieChart, ShieldCheck, Bell, Search, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';

export const Header = ({ onProfileClick, onSearchClick }: { onProfileClick: () => void, onSearchClick: () => void }) => (
  <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-2.5 flex justify-between items-center z-50">
    <div className="flex items-center gap-4 cursor-pointer group" onClick={onProfileClick}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
        <img src="/aapa-icon.png" alt="AAPA" className="w-full h-full object-cover scale-110" referrerPolicy="no-referrer" />
      </div>
      <h1 className="text-lg font-black tracking-tighter text-white flex items-center">
        AAPA <span className="text-emerald-500 ml-1.5">CAPITAL</span>
      </h1>
    </div>
    <div className="flex items-center gap-4">
      <button onClick={onSearchClick} className="p-2 rounded-xl text-zinc-400 hover:text-white transition-colors"><Search size={20} /></button>
      <button className="p-2 rounded-xl text-zinc-400 relative hover:text-white transition-colors">
        <Bell size={20} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-black" />
      </button>
    </div>
  </header>
);

export const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { user } = useAuthStore();
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'market', icon: TrendingUp, label: 'Market' },
    { id: 'fo', icon: Zap, label: 'F&O' },
    { id: 'portfolio', icon: PieChart, label: 'Portfolio' },
    ...(user?.role === 'admin' ? [{ id: 'admin', icon: ShieldCheck, label: 'Admin' }] : []),
    { id: 'more', icon: Wallet, label: 'Account' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-900 px-6 py-2.5 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex flex-col items-center gap-1 transition-all", activeTab === tab.id ? "text-emerald-500 scale-110" : "text-zinc-600 hover:text-zinc-400")}>
          <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};