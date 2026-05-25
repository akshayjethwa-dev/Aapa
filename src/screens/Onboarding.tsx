import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon,
  ShieldCheck,
  Rocket,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface OnboardingProps {
  onComplete: () => void;
  onConnectUpstox?: () => void;
  isConnectingUpstox?: boolean;
}

// ✅ 3 steps only — broker connect removed
const STEPS = [
  {
    id: 1,
    key: 'account',
    label: 'Account',
    title: 'Welcome to Aapa Capital',
    subtitle: "Your account is ready. Let's complete a quick setup",
    icon: UserIcon,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    glow: 'shadow-blue-500/20',
  },
  {
    id: 2,
    key: 'kyc',
    label: 'KYC & Risk',
    title: 'KYC & Risk Disclosure',
    subtitle: 'Review and acknowledge the risk disclosures as required by SEBI',
    icon: ShieldCheck,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/20',
  },
  {
    id: 3,
    key: 'ready',
    label: 'Ready',
    title: "You're All Set!",
    subtitle: 'Your account is ready. Start exploring the markets',
    icon: Rocket,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
  },
];

const RISK_ITEMS = [
  'Trading in equity, F&O, and derivatives involves substantial risk of loss.',
  'Past performance of any strategy is not indicative of future results.',
  'You may lose all or more than your invested capital in leveraged products.',
  'Market orders may be executed at prices different from the quoted price.',
  'SEBI registration does not guarantee any return on investment.',
  'Please read the full risk disclosure document before placing any trade.',
];

// ✅ Removed onConnectUpstox / isConnectingUpstox from usage (kept in props for App.tsx compatibility)
const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user, setAuth, token } = useAuthStore();
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [nameError, setNameError] = useState('');

  // Resume from last saved step — but only within new 3-step range
  useEffect(() => {
    if (user?.onboarding_step && user.onboarding_step > 0 && user.onboarding_step < 3) {
      setStep(user.onboarding_step);
    }
  }, []);

  const saveStep = async (newStep: number) => {
    try {
      setIsSaving(true);
      const payload: Record<string, any> = { onboarding_step: newStep };
      if (newStep === 4) {
        payload.first_login_completed_at = new Date().toISOString();
      }
      const res = await apiClient.patch('/api/user/onboarding', payload);
      if (res.data?.id && token) {
        setAuth(res.data, token);
      }
    } catch (e) {
      console.error('Failed to save onboarding step', e);
      toast.error('Could not save progress. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep1Continue = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setNameError('Please enter your full name (min 2 characters)');
      return;
    }
    setNameError('');
    await saveStep(2);
    setStep(2);
  };

  const handleStep2Continue = async () => {
    if (!riskAccepted) {
      toast.error('Please accept the risk disclosure to continue');
      return;
    }
    // ✅ Save as step 4 so isOnboardingComplete = true in App.tsx
    await saveStep(4);
    setStep(3);
  };

  const handleFinish = () => {
    toast.success('🎉 Welcome to Aapa Capital! Happy Trading!');
    onComplete();
  };

  const currentStepData = STEPS[step - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-black pb-36">
      {/* Header */}
      <div className="px-6 pt-14 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
            Aapa Capital
          </span>
          <span className="text-zinc-800">•</span>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">
            Setup
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-white">Account Setup</h1>
      </div>

      {/* Step Progress Bar */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    'h-1.5 w-full rounded-full transition-all duration-700',
                    s.id <= step
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                      : 'bg-zinc-900'
                  )}
                />
              </div>
              {i < STEPS.length - 1 && <div className="w-1" />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 flex-1 text-center',
                s.id === step ? 'text-emerald-400' : s.id < step ? 'text-zinc-500' : 'text-zinc-800'
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="px-6 space-y-8"
        >
          {/* Step Icon + Title */}
          <div className="flex items-start gap-5">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xl',
                currentStepData.bg,
                currentStepData.glow
              )}
            >
              <StepIcon className={cn('w-7 h-7', currentStepData.color)} />
            </div>
            <div className="pt-1">
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">
                Step {step} of 3
              </div>
              <h2 className="text-xl font-black tracking-tight text-white leading-tight">
                {currentStepData.title}
              </h2>
              <p className="text-[11px] font-bold text-zinc-500 mt-1 leading-relaxed">
                {currentStepData.subtitle}
              </p>
            </div>
          </div>

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-zinc-300">Email & Mobile registered</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-zinc-300">PAN number saved</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-zinc-300">Account created securely</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                  Confirm Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setNameError(''); }}
                  className={cn(
                    'w-full bg-zinc-900/30 border rounded-2xl py-4 px-5 text-sm font-bold text-white focus:outline-none transition-all',
                    nameError
                      ? 'border-rose-500/60 focus:border-rose-500'
                      : 'border-zinc-800/50 focus:border-emerald-500/50'
                  )}
                />
                {nameError && (
                  <div className="flex items-center gap-2 mt-1">
                    <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="text-[10px] font-bold text-rose-400">{nameError}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl py-4 px-5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: KYC & Risk ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-5 space-y-3 max-h-64 overflow-y-auto">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest sticky top-0 bg-zinc-900/80 backdrop-blur-sm pb-2">
                  Risk Disclosure — SEBI Mandate
                </p>
                {RISK_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[10px] font-black text-zinc-700 mt-0.5 shrink-0">{i + 1}.</span>
                    <p className="text-[11px] font-bold text-zinc-400 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setRiskAccepted(!riskAccepted)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border transition-all',
                  riskAccepted
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-zinc-900/30 border-zinc-800/50'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                    riskAccepted ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700'
                  )}
                >
                  {riskAccepted && <CheckCircle2 className="w-3 h-3 text-black" />}
                </div>
                <p className="text-[11px] font-bold text-left leading-relaxed text-zinc-300">
                  I have read and understood the risk disclosure. I accept full responsibility for my trading decisions.
                </p>
              </button>

              <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-zinc-600 leading-relaxed">
                  You can connect your broker (Upstox) anytime from the More tab. It's not required to get started.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Ready ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-10 text-center space-y-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 bg-emerald-500/10 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20"
                >
                  <Rocket className="w-12 h-12 text-emerald-400" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <p className="text-2xl font-black tracking-tighter text-white">Ready to Trade!</p>
                  <p className="text-[11px] font-bold text-zinc-500 leading-relaxed max-w-xs mx-auto">
                    Your Aapa Capital account is fully set up. Connect your broker from the More tab to enable live trading.
                  </p>
                </motion.div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '📈', label: 'Live Market', desc: 'NSE & BSE data' },
                  { icon: '💼', label: 'Portfolio', desc: 'Track holdings' },
                  { icon: '⚡', label: 'F&O Trading', desc: 'Options & Futures' },
                  { icon: '📊', label: 'Analytics', desc: 'P&L insights' },
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 space-y-1">
                    <span className="text-xl">{item.icon}</span>
                    <p className="text-xs font-black text-white">{item.label}</p>
                    <p className="text-[10px] font-bold text-zinc-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-xl border-t border-zinc-900 z-50">
        <div className="max-w-md mx-auto flex gap-3">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              disabled={isSaving}
              className="flex-[0.4] bg-zinc-900 text-zinc-400 font-bold py-4 rounded-2xl border border-zinc-800 hover:text-white transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step === 1 && (
            <button
              onClick={handleStep1Continue}
              disabled={isSaving}
              className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all text-[10px] uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleStep2Continue}
              disabled={isSaving || !riskAccepted}
              className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              I Accept & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleFinish}
              disabled={isSaving}
              className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all text-[10px] uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Rocket className="w-4 h-4" />
              Start Trading
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;