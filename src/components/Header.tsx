import React from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Header = ({ onProfileClick, onSearchClick }: { onProfileClick: () => void, onSearchClick: () => void }) => {
  const { user } = useAuthStore();
  return (
    <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-2.5 flex justify-between items-center z-50">
      <div className="flex items-center gap-4 cursor-pointer group" onClick={onProfileClick}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
          <img src="/aapa-icon.png" alt="AAPA" className="w-full h-full object-cover scale-110" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-lg font-black tracking-tighter text-white flex items-center">
          AAPA <span className="text-emerald-500 ml-1.5">CAPITAL</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onSearchClick}
          className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 transition-colors"
        >
          <Search size={20} />
        </button>
        <button className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-black" />
        </button>
      </div>
    </header>
  );
};

export default Header;