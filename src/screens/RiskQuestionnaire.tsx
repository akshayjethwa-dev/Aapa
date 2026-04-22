// src/screens/RiskQuestionnaire.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 5-question risk quiz. Scores responses and submits risk_profile to backend.
// Opens as a full-screen overlay from More.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { apiClient } from '../api/client';
import { useAuthStore, RiskProfile } from '../store/authStore';

// ─── Quiz data ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: 'How would you react if your portfolio dropped 20% in one month?',
    options: [
      { label: 'Sell everything immediately',       score: 1 },
      { label: 'Reduce exposure, stay cautious',    score: 2 },
      { label: 'Hold and wait for recovery',        score: 3 },
      { label: 'Buy more — great opportunity!',     score: 4 },
    ],
  },
  {
    q: 'What is your primary investment goal?',
    options: [
      { label: 'Capital preservation',             score: 1 },
      { label: 'Steady income',                    score: 2 },
      { label: 'Growth over 3–5 years',            score: 3 },
      { label: 'Maximum growth, short term',       score: 4 },
    ],
  },
  {
    q: 'How much of your savings are you willing to invest in markets?',
    options: [
      { label: 'Less than 10%',                    score: 1 },
      { label: '10–25%',                           score: 2 },
      { label: '25–50%',                           score: 3 },
      { label: 'More than 50%',                    score: 4 },
    ],
  },
  {
    q: 'Have you traded Futures & Options (F&O) before?',
    options: [
      { label: 'No, never',                        score: 1 },
      { label: 'Studied but never traded',         score: 2 },
      { label: 'A few times',                      score: 3 },
      { label: 'Regularly',                        score: 4 },
    ],
  },
  {
    q: 'How do you describe your investment experience?',
    options: [
      { label: 'Complete beginner',                score: 1 },
      { label: '1–2 years, mostly equity',         score: 2 },
      { label: '3–5 years with some derivatives',  score: 3 },
      { label: '5+ years, experienced trader',     score: 4 },
    ],
  },
];

function scoreToProfile(total: number): RiskProfile {
  if (total <= 9)  return 'conservative';
  if (total <= 15) return 'moderate';
  return 'aggressive';
}

// ─── Component ───────────────────────────────────────────────────────────────
interface RiskQuestionnaireProps {
  onClose: () => void;
  onComplete: (profile: RiskProfile) => void;
}

const RiskQuestionnaire: React.FC<RiskQuestionnaireProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(0);            // 0 = intro, 1–5 = questions, 6 = result
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1));
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [submitting, setSubmitting] = useState(false);
  const [resultProfile, setResultProfile] = useState<RiskProfile>(null);

  const { token, setAuth } = useAuthStore();

  const qIdx = step - 1; // question index (0-based)
  const question = QUESTIONS[qIdx];
  const totalQuestions = QUESTIONS.length;

  const handleStart = () => setStep(1);

  const handleOptionSelect = (optIdx: number) => setSelectedIdx(optIdx);

  const handleNext = () => {
    if (selectedIdx === -1) return;
    const updated = [...answers];
    updated[qIdx] = QUESTIONS[qIdx].options[selectedIdx].score;
    setAnswers(updated);
    setSelectedIdx(-1);
    if (step < totalQuestions) {
      setStep(step + 1);
    } else {
      const total = updated.reduce((a, b) => a + b, 0);
      const profile = scoreToProfile(total);
      setResultProfile(profile);
      setStep(totalQuestions + 1); // result screen
    }
  };

  const handleBack = () => {
    if (step === 0) { onClose(); return; }
    if (step === 1) { onClose(); return; }
    setStep(step - 1);
    const prevIdx = step - 2;
    if (prevIdx >= 0) {
      const prevScore = answers[prevIdx];
      if (prevScore !== -1) {
        const selIdx = QUESTIONS[prevIdx].options.findIndex(o => o.score === prevScore);
        setSelectedIdx(selIdx);
      } else {
        setSelectedIdx(-1);
      }
    }
  };

  const handleSubmit = async () => {
    if (!resultProfile) return;
    setSubmitting(true);
    try {
      await apiClient.patch('/api/user/risk-profile', { risk_profile: resultProfile });
      const profileRes = await apiClient.get('/api/user/profile');
      if (profileRes.data?.id && token) {
        setAuth(profileRes.data, token);
      }
      toast.success(
        `Risk profile set: ${resultProfile.charAt(0).toUpperCase() + resultProfile.slice(1)}`
      );
      onComplete(resultProfile);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to save risk profile');
    } finally {
      setSubmitting(false);
    }
  };

  const PROFILE_COLOR: Record<NonNullable<RiskProfile>, string> = {
    conservative: 'text-blue-400',
    moderate:     'text-amber-400',
    aggressive:   'text-rose-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 pt-14 pb-4">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft size={22} className="text-zinc-400" />
        </button>
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
          {step === 0
            ? 'Risk Questionnaire'
            : step <= totalQuestions
            ? `Question ${step} of ${totalQuestions}`
            : 'Your Result'}
        </p>
        <div className="w-10" />
      </div>

      {/* ── Progress bar (questions only) ── */}
      {step >= 1 && step <= totalQuestions && (
        <div className="px-6 mb-2">
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(step / totalQuestions) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <AnimatePresence mode="wait">
          {/* ── Intro ── */}
          {step === 0 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pt-10 space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Risk Profiling
                  </h1>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                    Answer 5 quick questions so we can understand your risk appetite and
                    unlock the right market segments for you.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    'Takes about 2 minutes',
                    'Unlocks F&O access if eligible',
                    'You can retake anytime',
                    'Aligned with SEBI requirements',
                  ].map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-3 text-sm text-zinc-400"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Question ── */}
          {step >= 1 && step <= totalQuestions && question && (
            <motion.div
              key={`q-${step}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="pt-8 space-y-8"
            >
              <h2 className="text-xl font-black text-white leading-snug tracking-tight">
                {question.q}
              </h2>
              <div className="space-y-3">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(i)}
                    className={cn(
                      'w-full text-left px-5 py-4 rounded-2xl border font-bold text-sm transition-all',
                      selectedIdx === i
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
                          selectedIdx === i ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'
                        )}
                      >
                        {selectedIdx === i && (
                          <div className="w-2 h-2 rounded-full bg-black" />
                        )}
                      </div>
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Result ── */}
          {step === totalQuestions + 1 && resultProfile && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pt-10 space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <CheckCircle2 size={36} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500 uppercase tracking-widest font-bold">
                    Your risk profile
                  </p>
                  <h1
                    className={cn(
                      'text-3xl font-black mt-1 uppercase tracking-wider',
                      PROFILE_COLOR[resultProfile]
                    )}
                  >
                    {resultProfile}
                  </h1>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                {resultProfile === 'conservative' && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-white">What this means for you</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You prefer capital protection over high returns.{' '}
                      <span className="text-white font-semibold">Equity segment</span> is
                      enabled. F&O (derivatives) requires moderate or aggressive profile.
                    </p>
                  </div>
                )}
                {resultProfile === 'moderate' && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-white">What this means for you</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You balance risk and reward.{' '}
                      <span className="text-white font-semibold">Equity segment</span> is
                      enabled. F&O access requires Aggressive profile.
                    </p>
                  </div>
                )}
                {resultProfile === 'aggressive' && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-white">What this means for you</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You seek high returns and can handle volatility.{' '}
                      <span className="text-white font-semibold">
                        Equity + F&O segments
                      </span>{' '}
                      will be enabled for your account.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="px-6 pb-10 pt-4 border-t border-zinc-900">
        {step === 0 && (
          <button
            onClick={handleStart}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            Start Quiz <ArrowRight size={18} />
          </button>
        )}

        {step >= 1 && step <= totalQuestions && (
          <button
            onClick={handleNext}
            disabled={selectedIdx === -1}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-black font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {step === totalQuestions ? 'See Result' : 'Next'} <ArrowRight size={18} />
          </button>
        )}

        {step === totalQuestions + 1 && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-5 rounded-2xl transition-all"
          >
            {submitting ? 'Saving...' : 'Save Profile'}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default RiskQuestionnaire;