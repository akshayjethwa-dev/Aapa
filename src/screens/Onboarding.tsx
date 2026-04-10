import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const Onboarding = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  return (
    <div className="min-h-screen bg-black p-8 space-y-10 pb-32">
      <div className="space-y-3 pt-12">
        <h2 className="text-3xl font-black tracking-tighter text-white">Demat Onboarding</h2>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
          Step {step} of 4: <span className="text-emerald-500">{step === 1 ? 'PAN Verification' : step === 2 ? 'Aadhaar eKYC' : step === 3 ? 'Bank Linking' : 'IPV Verification'}</span>
        </p>
      </div>
      
      <div className="flex gap-2">
        {[1,2,3,4].map(s => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", s <= step ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-zinc-900")} />
        ))}
      </div>

      <motion.div 
        key={step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">PAN Number</label>
              <input type="text" placeholder="ABCDE1234F" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm uppercase font-bold tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Date of Birth</label>
              <input type="date" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">We will securely redirect you to Digilocker for Aadhaar eKYC verification.</p>
            <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl mx-auto flex items-center justify-center">
                <ShieldCheck className="text-emerald-500" size={40} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Secure Verification</p>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Powered by Digilocker</p>
              </div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Account Number</label>
              <input type="text" placeholder="000000000000" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">IFSC Code</label>
              <input type="text" placeholder="HDFC0001234" className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-5 px-6 text-sm uppercase font-bold tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all" />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-6">
            <div className="aspect-video bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 flex items-center justify-center relative overflow-hidden group">
              <UserIcon size={64} className="text-zinc-800 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 bg-zinc-900/80 backdrop-blur-xl p-4 rounded-2xl border border-zinc-800/50">
                <p className="text-[10px] font-bold text-white text-center uppercase tracking-widest">Record a 5-second video saying "1234"</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/80 backdrop-blur-xl border-t border-zinc-900 flex gap-4 z-50">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 bg-zinc-900 text-zinc-400 font-bold py-5 rounded-2xl border border-zinc-800 hover:text-white transition-all uppercase text-[10px] tracking-widest">Back</button>
        )}
        <button 
          onClick={() => step < 4 ? setStep(step + 1) : onComplete()} 
          className="flex-1 bg-emerald-500 text-black font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all uppercase text-[10px] tracking-widest"
        >
          {step === 4 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;