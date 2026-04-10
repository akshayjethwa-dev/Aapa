import React from 'react';
import { LayoutDashboard, TrendingUp, Wallet, User as UserIcon, MoreHorizontal, Zap, PieChart, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
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
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300",
            activeTab === tab.id ? "text-emerald-500 scale-110" : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default Navbar;