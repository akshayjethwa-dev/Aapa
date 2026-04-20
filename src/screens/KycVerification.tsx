import React from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, ExternalLink, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const KycVerification = ({
  onConnectUptox,
  isConnectingUptox
}: {
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
}) => {
  const { user } = useAuthStore();

  return (
    <div className="min-h-[80vh] flex flex-col justify-center px-6 py-12 space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-emerald-500/10 rounded-4xl mx-auto flex items-center justify-center border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <ShieldCheck size={40} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">Broker Setup</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            Final Step Before Trading
          </p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md"
      >
        {user?.role === 'pre-onboarding' ? (
          // UI for users who need to OPEN an account
          <div className="space-y-6">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 flex gap-3">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-sm font-black text-rose-500 tracking-tight">Account Required</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  You indicated that you do not have an Upstox account. You must open one to trade on Aapa Capital.
                </p>
              </div>
            </div>

            <a 
              href="https://upstox.com/open-demat-account/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full bg-[#5228D3] hover:bg-[#431db3] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-[#5228D3]/20 tracking-widest uppercase text-[11px] flex items-center justify-center gap-2"
            >
              Open Upstox Account <ExternalLink className="w-4 h-4" />
            </a>

            <div className="border-t border-zinc-800/50 pt-6 mt-6">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center mb-4">
                Already finished opening?
              </p>
              <button 
                onClick={onConnectUptox}
                disabled={isConnectingUptox}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-4 rounded-2xl transition-all tracking-widest uppercase text-[11px] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                {isConnectingUptox ? 'Connecting...' : 'Connect Account'}
              </button>
            </div>
          </div>
        ) : (
          // UI for users who already HAVE an account but need to link it
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Link Your Upstox Account</h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-62.5 mx-auto">
                Securely authorize Aapa Capital to place orders and fetch live portfolio data on your behalf.
              </p>
            </div>

            <div className="bg-black/40 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-xs text-zinc-300 font-medium">
                <CheckCircle2 size={16} className="text-emerald-500" /> Live Market Data feeds
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-300 font-medium">
                <CheckCircle2 size={16} className="text-emerald-500" /> One-click order execution
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-300 font-medium">
                <CheckCircle2 size={16} className="text-emerald-500" /> Real-time P&L sync
              </div>
            </div>

            <button 
              onClick={onConnectUptox}
              disabled={isConnectingUptox}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isConnectingUptox ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Waiting for Authorization...
                </>
              ) : (
                <>Authorize Upstox <ArrowRight size={16} /></>
              )}
            </button>
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              You will be redirected to Upstox
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default KycVerification;