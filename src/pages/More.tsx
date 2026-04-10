import React from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function More({ activeTab, setActiveTab }: any) {
  const { logout, user } = useAuthStore();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <User className="text-emerald-500" size={24} />
        </div>
        <div>
          <h3 className="text-white font-bold">{user?.email || 'User'}</h3>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">{user?.role}</p>
        </div>
      </div>

      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-white hover:bg-zinc-800 transition-colors">
          <Settings size={18} className="text-zinc-400" />
          <span className="font-bold text-sm">Account Settings</span>
        </button>

        {/* Uses the updated logout function from authStore which clears cookies */}
        <button 
          onClick={logout} 
          className="w-full flex items-center gap-3 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition-colors"
        >
          <LogOut size={18} />
          <span className="font-bold text-sm">Log Out</span>
        </button>
      </div>
    </div>
  );
}