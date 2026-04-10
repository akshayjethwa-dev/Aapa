import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { cn } from '../lib/utils';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  
  // NEW: State for Terms & Conditions
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // NEW: Block registration if terms are not accepted
    if (!isLogin && !termsAccepted) {
      toast.error("You must accept the Terms & Conditions to register.");
      return;
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { login: email, password } : { email, mobile, password };

    try {
      const res = await apiClient.post(endpoint, body);
      
      if (res.data.token) {
        setAuth(res.data.user, res.data.token);
      } else if (!isLogin && res.data.id) {
        setIsLogin(true);
        toast.success('Account created! Please sign in.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to connect to server');
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#111827] px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center flex flex-col items-center">
        <div className="relative flex flex-col items-center mb-6">
          <img src="/aapa-logo.png" alt="Aapa Logo" className="w-48 block mx-auto mb-2 object-contain mix-blend-lighten" referrerPolicy="no-referrer" />
          <h1 className="text-3xl font-extrabold tracking-wide leading-tight">
            <span className="text-white">{isAdminLogin && isLogin ? 'ADMIN ' : 'AAPA '}</span>
            <span className="text-emerald-500">{isAdminLogin && isLogin ? 'ACCESS' : 'CAPITAL'}</span>
          </h1>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md text-left w-full">
          {isLogin && (
            <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800/50 mb-8">
              <button onClick={() => setIsAdminLogin(false)} className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", !isAdminLogin ? "bg-emerald-500 text-black shadow-lg" : "text-zinc-500")}>User</button>
              <button onClick={() => setIsAdminLogin(true)} className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", isAdminLogin ? "bg-emerald-500 text-black shadow-lg" : "text-zinc-500")}>Admin</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder={isLogin ? "Email or Mobile Number" : "name@example.com"} required />
              
              {!isLogin && (
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="+91 00000 00000" required />
              )}
              
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="••••••••" required />
            </div>

            {/* NEW: Checkbox for Terms & Conditions on Registration */}
            {!isLogin && (
              <div className="flex items-center mt-4">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 bg-black border-zinc-800 rounded focus:ring-emerald-500 focus:ring-2"
                />
                <label htmlFor="terms" className="ml-2 text-xs text-zinc-400">
                  I accept the <a href="#" className="text-emerald-500 hover:underline">Terms & Conditions</a>
                </label>
              </div>
            )}

            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] mt-4">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
            <button onClick={() => setIsLogin(!isLogin)} className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest transition-colors">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}