import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, AlertCircle, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[Auth] Submitting ${isLogin ? 'login' : 'registration'} form...`);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { login: email, password } : { email, mobile, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Server returned an error' }));
        console.error('[Auth] Request failed:', errorData);
        toast.error(errorData.error || 'Something went wrong');
        return;
      }

      const data = await res.json();
      console.log('[Auth] Response received:', data);
      
      if (data.token) {
        setAuth(data.user, data.token);
      } else if (!isLogin && data.id) {
        setIsLogin(true);
        toast.success('Account created! Please sign in.');
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch (err: any) {
      console.error('[Auth] Network or parsing error:', err);
      toast.error('Failed to connect to server. Please check your connection.');
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto flex items-center justify-center bg-linear-to-br from-[#0f172a] to-[#111827] px-4 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center flex flex-col items-center"
      >
        <div className="relative flex flex-col items-center mb-6">
          <img 
            src="/aapa-logo.png" 
            alt="Aapa Logo" 
            className="w-48 block mx-auto mb-2 object-contain mix-blend-lighten"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-3xl font-extrabold tracking-wide leading-tight">
            <span className="text-white">{isAdminLogin && isLogin ? 'ADMIN ' : 'AAPA '}</span>
            <span className="text-emerald-500">{isAdminLogin && isLogin ? 'ACCESS' : 'CAPITAL'}</span>
          </h1>
          <p className="text-[10px] text-gray-400 mt-1 tracking-[3px]">
            {isAdminLogin && isLogin ? 'MANAGE PLATFORM' : 'TRADE FEARLESS WITH AAPA'}
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md text-left w-full">
          {isLogin && (
            <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800/50 mb-8">
              <button 
                onClick={() => setIsAdminLogin(false)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  !isAdminLogin ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                User
              </button>
              <button 
                onClick={() => setIsAdminLogin(true)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  isAdminLogin ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                Admin
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  {isLogin ? 'Email or Mobile' : 'Email Address'}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder={isLogin ? "Email or Mobile Number" : "name@example.com"}
                  required
                />
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="+91 00000 00000"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] mt-4"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="group text-[11px] font-bold text-zinc-400 uppercase tracking-widest transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-emerald-500 group-hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/30">Sign up</span></>
              ) : (
                <>Already have an account? <span className="text-emerald-500 group-hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/30">Sign in</span></>
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest leading-relaxed">
            By continuing, you agree to Aapa Capital's<br />
            <span className="text-zinc-500">Terms of Service</span> and <span className="text-zinc-500">Privacy Policy</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;