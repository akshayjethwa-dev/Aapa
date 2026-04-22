// src/screens/ProfileCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable profile summary card shown at the top of More.tsx
// Shows: KYC status chip, profile completeness ring, segments, risk profile
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock4,
  TrendingUp, BarChart2, Zap, CheckCircle2, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, KycStatus, RiskProfile, SegmentCode } from '../store/authStore';

// ─────────────────────────────────────────────────────────────────────────────
// KYC chip config
// ─────────────────────────────────────────────────────────────────────────────
const KYC_CONFIG: Record<
  KycStatus,
  { label: string; Icon: any; bg: string; text: string; border: string }
> = {
  not_started: {
    label: 'KYC Pending',
    Icon: ShieldAlert,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  pending: {
    label: 'KYC Under Review',
    Icon: Clock4,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  approved: {
    label: 'KYC Approved',
    Icon: ShieldCheck,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  rejected: {
    label: 'KYC Rejected',
    Icon: ShieldX,
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Segment config
// ─────────────────────────────────────────────────────────────────────────────
const SEGMENT_CONFIG: Record<SegmentCode, { label: string; Icon: any; color: string }> = {
  EQUITY:    { label: 'Equity',    Icon: TrendingUp,  color: 'text-emerald-400' },
  FO:        { label: 'F&O',       Icon: BarChart2,   color: 'text-purple-400'  },
  COMMODITY: { label: 'Commodity', Icon: Zap,         color: 'text-orange-400' },
  CURRENCY:  { label: 'Currency',  Icon: BarChart2,   color: 'text-blue-400'   },
};

// ─────────────────────────────────────────────────────────────────────────────
// Risk profile config
// ─────────────────────────────────────────────────────────────────────────────
const RISK_CONFIG: Record<
  NonNullable<RiskProfile>,
  { label: string; color: string; desc: string }
> = {
  conservative: { label: 'Conservative', color: 'text-blue-400',   desc: 'Low risk, stable returns' },
  moderate:     { label: 'Moderate',     color: 'text-amber-400',  desc: 'Balanced risk-return'     },
  aggressive:   { label: 'Aggressive',   color: 'text-rose-400',   desc: 'High risk, high reward'   },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG completeness ring
// ─────────────────────────────────────────────────────────────────────────────
const CompletenessRing = ({ percent }: { percent: number }) => {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
      <circle cx="40" cy="40" r={r} stroke="#27272a" strokeWidth="6" fill="none" />
      <motion.circle
        cx="40"
        cy="40"
        r={r}
        stroke={percent === 100 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444'}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
interface ProfileCardProps {
  user: User & { profile_completeness?: number };
  onRetakeQuestionnaire: () => void;
  onStartKyc: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  user,
  onRetakeQuestionnaire,
  onStartKyc,
}) => {
  const completeness = user.profile_completeness ?? 0;
  const kyc = (user.kyc_status ?? 'not_started') as KycStatus;
  const kycConf = KYC_CONFIG[kyc];
  const KycIcon = kycConf.Icon;

  const segments: SegmentCode[] = Array.isArray(user.segments_enabled)
    ? (user.segments_enabled as SegmentCode[])
    : ['EQUITY'];

  const riskConf = user.risk_profile ? RISK_CONFIG[user.risk_profile] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden"
    >
      {/* ── Header row ── */}
      <div className="p-5 flex items-center gap-5">
        {/* Ring + % */}
        <div className="relative shrink-0">
          <CompletenessRing percent={completeness} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black text-white leading-none">
              {completeness}%
            </span>
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">
              Profile
            </span>
          </div>
        </div>

        {/* KYC status + CTA */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
            Profile Status
          </p>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider',
              kycConf.bg,
              kycConf.text,
              kycConf.border
            )}
          >
            <KycIcon size={11} />
            {kycConf.label}
          </div>

          {kyc !== 'approved' && (
            <button
              onClick={onStartKyc}
              className="mt-2 text-[10px] font-bold text-emerald-400 underline underline-offset-2 block"
            >
              {kyc === 'rejected' ? 'Re-submit KYC →' : 'Complete KYC →'}
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-zinc-800/60 mx-5" />

      {/* ── Segments ── */}
      <div className="p-5">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
          Segments Enabled
        </p>
        <div className="flex flex-wrap gap-2">
          {(['EQUITY', 'FO', 'COMMODITY', 'CURRENCY'] as SegmentCode[]).map((seg) => {
            const enabled = segments.includes(seg);
            const conf = SEGMENT_CONFIG[seg];
            const Icon = conf.Icon;
            return (
              <div
                key={seg}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all',
                  enabled
                    ? 'bg-zinc-800/80 border-zinc-700/50 text-white'
                    : 'bg-zinc-900/20 border-zinc-800/20 text-zinc-600 opacity-50'
                )}
              >
                <Icon size={11} className={enabled ? conf.color : 'text-zinc-600'} />
                {conf.label}
                {enabled && <CheckCircle2 size={9} className={conf.color} />}
              </div>
            );
          })}
        </div>
        {!segments.includes('FO') && (
          <p className="mt-2 text-[10px] text-zinc-600 flex items-center gap-1">
            <AlertCircle size={10} />
            F&amp;O requires Aggressive risk profile + approved KYC
          </p>
        )}
      </div>

      <div className="h-px bg-zinc-800/60 mx-5" />

      {/* ── Risk profile ── */}
      <div className="p-5">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
          Risk Profile
        </p>
        {riskConf ? (
          <div className="flex items-center justify-between">
            <div>
              <p
                className={cn(
                  'text-sm font-black uppercase tracking-wider',
                  riskConf.color
                )}
              >
                {riskConf.label}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{riskConf.desc}</p>
            </div>
            <button
              onClick={onRetakeQuestionnaire}
              className="text-[10px] font-bold text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-xl transition-all"
            >
              Retake →
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">No risk profile set yet</p>
            <button
              onClick={onRetakeQuestionnaire}
              className="text-[10px] font-bold text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1.5 rounded-xl transition-all"
            >
              Take Quiz →
            </button>
          </div>
        )}
      </div>

      {/* ── Upstox connectivity ── */}
      <div className="px-5 pb-5">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold',
            user.is_uptox_connected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-500'
          )}
        >
          <Zap size={11} />
          Upstox: {user.is_uptox_connected ? 'Connected' : 'Not Connected'}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileCard;