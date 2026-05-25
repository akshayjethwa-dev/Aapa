// src/screens/Auth.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  
  // States
  const [name, setName] = useState('');
  const [pan, setPan] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { setAuth } = useAuthStore();

  // Directly toggles between Login and Registration forms
  const handleToggleMode = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setTermsAccepted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !termsAccepted) {
      toast.error('You must accept the Terms, Privacy Policy, and Risk Disclosure to create an account.');
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    const body = isLogin 
      ? { login: email, password } 
      : { name, pan, email, mobile, password };

    try {
      const res = await apiClient.post(endpoint, body);
      const data = res.data;
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        setAuth(data.user, data.token);
        toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      } else if (!isLogin && data.id) {
        // Auto-login after successful registration
        try {
          const loginRes = await apiClient.post('/api/auth/login', { login: email, password });
          const loginData = loginRes.data;
          
          if (loginData.token) {
            localStorage.setItem('token', loginData.token);
            setAuth(loginData.user, loginData.token);
          } else {
            handleToggleMode(true);
            toast.success('Account created! Please sign in.');
          }
        } catch (loginErr) {
          handleToggleMode(true);
          toast.success('Account created! Please sign in.');
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401 && isLogin) {
        toast.error('Invalid credentials');
      } else {
        toast.error(err.response?.data?.message || err.response?.data?.error || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthForm = () => (
    <motion.form 
      key={isLogin ? 'login' : 'register'}
      initial={{ opacity: 0, x: isLogin ? -20 : 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit} 
      className="space-y-5"
    >
      <div className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              placeholder="John Doe"
              required
            />
          </div>
        )}

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
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              placeholder="9876543210"
              required
            />
          </div>
        )}

        {!isLogin && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">PAN Number</label>
            <input
              type="text"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              className="w-full bg-black/50 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all uppercase"
              placeholder="ABCDE1234F"
              maxLength={10}
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

      {!isLogin && (
        <div className="flex items-start gap-3 mt-4 bg-black/30 p-4 rounded-2xl border border-zinc-800/50">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-zinc-800 bg-black/50 accent-emerald-500 shrink-0 cursor-pointer"
            required
          />
          <label htmlFor="terms" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed cursor-pointer">
            I agree to the{' '}
            <a href="/terms" target="_blank" className="text-emerald-500 hover:underline">Terms of Service</a>,{' '}
            <a href="/privacy" target="_blank" className="text-emerald-500 hover:underline">Privacy Policy</a>, and{' '}
            <a href="/risk-disclosure" target="_blank" className="text-emerald-500 hover:underline">Risk Disclosure</a>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading && (
            <svg className="animate-spin h-4 w-4 text-black shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        )}
        {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
      </button>
    </motion.form>
  );

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

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md text-left w-full overflow-hidden">
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

          <AnimatePresence mode="wait">
             {renderAuthForm()}
          </AnimatePresence>

          <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
            <button
              onClick={() => handleToggleMode(!isLogin)}
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
      </motion.div>
    </div>
  );
};

export default Auth;