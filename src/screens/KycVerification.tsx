import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

const KycVerification = ({ onBack }: { onBack: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-black p-6 space-y-8"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-black text-white uppercase tracking-tight">Compliance</h2>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-4xl p-8 text-center space-y-5">
        <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
          <ShieldAlert size={40} className="text-amber-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tighter">KYC Verification Required</h3>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            As per SEBI regulations, you must verify your identity and trading intent before placing orders on the market.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-2">Verification Steps</p>
        
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Basic Profile</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Mobile and Email verified</p>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Identity Documents</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">PAN and Aadhaar Card pending</p>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <button className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20">
          Start KYC Process
        </button>
      </div>
    </motion.div>
  );
};

export default KycVerification;