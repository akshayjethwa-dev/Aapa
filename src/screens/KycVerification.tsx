import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCcw,
  CreditCard,
  Camera,
  Landmark,
  FileSignature,
  FileText,
} from 'lucide-react';
import { useAuthStore, KycStatus } from '../store/authStore';

// ─── Props ────────────────────────────────────────────────────────────────────
interface KycVerificationProps {
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
}

// ─── KYC Status Badge ─────────────────────────────────────────────────────────
const KycStatusBadge = ({ status }: { status: KycStatus | undefined }) => {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    approved:    { label: 'KYC Approved',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    pending:     { label: 'KYC Pending',      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    rejected:    { label: 'KYC Rejected',     color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
    not_started: { label: 'KYC Not Started',  color: 'text-zinc-400',    bg: 'bg-zinc-800/40',    border: 'border-zinc-700/40' },
  };
  const cfg = map[status ?? 'not_started'] ?? map['not_started'];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
};

// ─── Documents Summary ────────────────────────────────────────────────────────
const docItems: { Icon: React.ElementType; label: string }[] = [
  { Icon: CreditCard,    label: 'PAN Card' },
  { Icon: ShieldCheck,   label: 'Aadhaar Card' },
  { Icon: Landmark,      label: 'Bank Proof' },
  { Icon: Camera,        label: 'Selfie' },
  { Icon: FileSignature, label: 'e-Sign (OTP)' },
];

// ─── Pre-Onboarding Panel ─────────────────────────────────────────────────────
const PreOnboardingPanel = ({
  kycStatus,
  onConnectUptox,
  isConnectingUptox,
}: {
  kycStatus: KycStatus | undefined;
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
}) => (
  <div className="space-y-5">
    <div className="flex justify-center">
      <KycStatusBadge status={kycStatus} />
    </div>

    {/* Alert */}
    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 flex gap-3">
      <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
      <div>
        <h4 className="text-sm font-black text-rose-500 tracking-tight">Upstox Account Required</h4>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          You need an Upstox demat account to trade on Aapa Capital. Opening an account
          includes completing KYC — it takes under 10 minutes.
        </p>
      </div>
    </div>

    {/* Documents needed */}
    <div className="bg-black/40 border border-zinc-800/40 rounded-2xl p-4 space-y-3">
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
        Keep these ready
      </p>
      <div className="grid grid-cols-2 gap-2">
        {docItems.map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={13} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-300">{label}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Timeline pill */}
    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-500">
      <Clock size={12} className="text-zinc-600" />
      <span>Submission ~10 min · Activation within 24–48 hrs</span>
    </div>

    {/* Open Account CTA */}
    <a
      href="https://upstox.com/open-demat-account/"
      target="_blank"
      rel="noopener noreferrer"
      className="w-full bg-[#5228D3] hover:bg-[#431db3] active:bg-[#3515a0] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-[#5228D3]/20 tracking-widest uppercase text-[11px] flex items-center justify-center gap-2"
    >
      Open Upstox Account <ExternalLink className="w-4 h-4" />
    </a>

    {/* Upstox Help */}
    <a
      href="https://help.upstox.com/support/solutions/articles/47001133779"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
    >
      <FileText size={11} /> KYC Guide on Upstox Help
    </a>

    {/* Already opened divider */}
    <div className="border-t border-zinc-800/50 pt-5">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center mb-4">
        Already opened your account?
      </p>
      <button
        onClick={onConnectUptox}
        disabled={isConnectingUptox}
        className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-black py-4 rounded-2xl transition-all tracking-widest uppercase text-[11px] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Zap size={16} />
        {isConnectingUptox ? 'Connecting...' : 'Connect My Account'}
      </button>
    </div>
  </div>
);

// ─── Link Account Panel ───────────────────────────────────────────────────────
const LinkAccountPanel = ({
  kycStatus,
  onConnectUptox,
  isConnectingUptox,
}: {
  kycStatus: KycStatus | undefined;
  onConnectUptox: () => void;
  isConnectingUptox: boolean;
}) => {
  const isRejected = kycStatus === 'rejected';
  const isPending  = kycStatus === 'pending';

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <KycStatusBadge status={kycStatus} />
      </div>

      {isPending && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-left">
          <Clock className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your KYC documents are under review. Upstox usually completes verification
            within <span className="text-amber-400 font-bold">1–2 business days</span>. You
            will receive an email once approved.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-left">
          <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-xs font-black text-rose-400 mb-1">KYC Rejected</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your documents could not be verified. Please re-open the Upstox KYC flow,
              check your documents, and resubmit.
            </p>
            <a
              href="https://help.upstox.com/support/solutions/articles/47001133780"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-2"
            >
              View rejected reasons <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-lg font-black text-white">
          {isRejected ? 'Re-submit KYC on Upstox' : 'Link Your Upstox Account'}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
          {isRejected
            ? 'Fix your documents on Upstox, then come back and re-authorize Aapa Capital.'
            : 'Securely authorize Aapa Capital to place orders and fetch live portfolio data on your behalf.'}
        </p>
      </div>

      {/* Feature checklist */}
      <div className="bg-black/40 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-3 text-left">
        {[
          'Live Market Data feeds',
          'One-click order execution',
          'Real-time P&L sync',
          'KYC status auto-sync',
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-xs text-zinc-300 font-medium">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            {item}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onConnectUptox}
        disabled={isConnectingUptox}
        className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isConnectingUptox ? (
          <>
            <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Waiting for Authorization...
          </>
        ) : isRejected ? (
          <><RefreshCcw size={15} /> Re-open Upstox KYC</>
        ) : (
          <>Authorize Upstox <ArrowRight size={16} /></>
        )}
      </button>

      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
        {isRejected
          ? 'You will be redirected to Upstox to fix & resubmit'
          : 'You will be redirected to Upstox for secure login'}
      </p>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const KycVerification = ({ onConnectUptox, isConnectingUptox }: KycVerificationProps) => {
  const { user } = useAuthStore();
  const kycStatus = user?.kyc_status;
  const isPreOnboarding = user?.role === 'pre-onboarding';

  return (
    <div className="min-h-[80vh] flex flex-col justify-center px-6 py-12 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-emerald-500/10 rounded-4xl mx-auto flex items-center justify-center border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <ShieldCheck size={40} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">
            {isPreOnboarding ? 'Open & Verify Account' : 'Broker Setup'}
          </h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            {isPreOnboarding
              ? 'Step 1 — Open Upstox · Step 2 — Complete KYC'
              : 'Final Step Before Trading'}
          </p>
        </div>
      </motion.div>

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md"
      >
        {isPreOnboarding ? (
          <PreOnboardingPanel
            kycStatus={kycStatus}
            onConnectUptox={onConnectUptox}
            isConnectingUptox={isConnectingUptox}
          />
        ) : (
          <LinkAccountPanel
            kycStatus={kycStatus}
            onConnectUptox={onConnectUptox}
            isConnectingUptox={isConnectingUptox}
          />
        )}
      </motion.div>
    </div>
  );
};

export default KycVerification;