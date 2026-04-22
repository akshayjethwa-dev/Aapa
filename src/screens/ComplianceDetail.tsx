import React from 'react';
import {
  ChevronRight,
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Camera,
  Landmark,
  FileSignature,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore, KycStatus } from '../store/authStore';

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComplianceDetailProps {
  type: string;
  onBack: () => void;
  onOpenKycFlow?: () => void;
}

// ─── KYC Status Banner ────────────────────────────────────────────────────────
const KycStatusBanner = ({ status }: { status: KycStatus | undefined }) => {
  const config: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
    approved: {
      label: 'KYC Approved — You are all set to trade!',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      Icon: CheckCircle2,
    },
    pending: {
      label: 'KYC Under Review — Usually takes 1–2 business days.',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      Icon: Clock,
    },
    rejected: {
      label: 'KYC Rejected — Please re-submit your documents on Upstox.',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      Icon: AlertCircle,
    },
    not_started: {
      label: 'KYC Not Started — Complete KYC to start trading.',
      color: 'text-zinc-400',
      bg: 'bg-zinc-800/40',
      border: 'border-zinc-700/40',
      Icon: AlertCircle,
    },
  };

  const key = status ?? 'not_started';
  const { label, color, bg, border, Icon } = config[key] ?? config['not_started'];

  return (
    <div className={`${bg} border ${border} rounded-2xl p-4 flex items-center gap-3`}>
      <Icon size={18} className={color} />
      <p className={`text-xs font-bold ${color}`}>{label}</p>
    </div>
  );
};

// ─── Documents List ───────────────────────────────────────────────────────────
const documents: { Icon: React.ElementType; name: string; desc: string }[] = [
  { Icon: CreditCard,    name: 'PAN Card',      desc: 'Permanent Account Number — mandatory for all investors' },
  { Icon: ShieldCheck,   name: 'Aadhaar Card',  desc: 'For address & identity verification (DigiLocker or upload)' },
  { Icon: Landmark,      name: 'Bank Proof',    desc: 'Cancelled cheque or latest bank statement (last 3 months)' },
  { Icon: Camera,        name: 'Selfie / Live Photo', desc: 'In-app selfie for face-match verification' },
  { Icon: FileSignature, name: 'e-Sign',        desc: 'Aadhaar-based OTP e-sign to authorise account opening' },
];

// ─── Timeline Steps ───────────────────────────────────────────────────────────
const timeline = [
  { step: '1', label: 'Submit Documents',          time: '~5 min' },
  { step: '2', label: 'Aadhaar e-Sign OTP',        time: '~2 min' },
  { step: '3', label: 'Upstox Verification',       time: '1–2 hrs' },
  { step: '4', label: 'SEBI / Exchange Approval',  time: 'Same day' },
  { step: '5', label: 'Account Activated',         time: '24–48 hrs' },
];

// ─── Static Compliance Content ────────────────────────────────────────────────
const staticContent: Record<string, { title: string; text: string }> = {
  'SEBI Disclaimer': {
    title: 'SEBI Disclaimer',
    text: 'Investment in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.',
  },
  'Risk Disclosure': {
    title: 'Risk Disclosure',
    text: 'Trading in derivatives (Futures and Options) involves significant risk and is not suitable for all investors. 9 out of 10 individual traders in equity Futures and Options Segment, incurred net losses. On an average, loss makers registered net loss close to ₹50,000.',
  },
  'Terms & Conditions': {
    title: 'Terms & Conditions',
    text: 'By using Aapa Capital, you agree to our terms of service. We provide a platform for trading and do not provide financial advice. All trades are executed at your own risk. Brokerage and other charges apply as per the fee schedule.',
  },
};

// ─── KYC Hub Screen ───────────────────────────────────────────────────────────
const KycHubScreen = ({
  kycStatus,
  onOpenKycFlow,
}: {
  kycStatus: KycStatus | undefined;
  onOpenKycFlow: () => void;
}) => {
  const isApproved = kycStatus === 'approved';

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <KycStatusBanner status={kycStatus} />

      {/* Why KYC */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-zinc-900/40 border border-zinc-800/40 rounded-4xl p-6 space-y-3"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-500" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Why KYC is Required
          </h3>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          SEBI (Securities and Exchange Board of India) mandates KYC for every investor to
          prevent fraud, money laundering, and identity theft. Without a completed KYC you
          cannot place any trades on Indian stock exchanges. It is a one-time process — once
          done, it is valid for all SEBI-regulated brokers.
        </p>
        <a
          href="https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest"
        >
          SEBI KYC Guidelines <ExternalLink size={11} />
        </a>
      </motion.div>

      {/* Documents Required */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900/40 border border-zinc-800/40 rounded-4xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-emerald-500" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Documents You Need
          </h3>
        </div>
        <div className="space-y-3">
          {documents.map(({ Icon, name, desc }) => (
            <div key={name} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={15} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-black text-white">{name}</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-zinc-900/40 border border-zinc-800/40 rounded-4xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-emerald-500" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            How Long It Takes
          </h3>
        </div>
        <div className="space-y-3">
          {timeline.map(({ step, label, time }) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-black text-emerald-400">{step}</span>
              </div>
              <div className="flex-1 flex items-center justify-between">
                <p className="text-xs text-zinc-300 font-medium">{label}</p>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  {time}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Total time: under 10 minutes to submit. Activation within 24–48 hours on working days.
        </p>
      </motion.div>

      {/* Upstox Help Links */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900/40 border border-zinc-800/40 rounded-4xl p-6 space-y-3"
      >
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Upstox Help Resources
        </h3>
        {[
          { label: 'KYC Step-by-Step Guide',  url: 'https://help.upstox.com/support/solutions/articles/47001133779-how-to-open-demat-account' },
          { label: 'Documents Checklist',     url: 'https://help.upstox.com/support/solutions/articles/47001133780' },
          { label: 'Upstox Help Center',      url: 'https://help.upstox.com' },
        ].map(({ label, url }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/30 rounded-xl"
          >
            <span className="text-xs font-bold text-zinc-300">{label}</span>
            <ExternalLink size={13} className="text-zinc-500" />
          </a>
        ))}
      </motion.div>

      {/* CTA */}
      {!isApproved ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <button
            onClick={onOpenKycFlow}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 tracking-widest uppercase text-[11px] flex items-center justify-center gap-2"
          >
            <ExternalLink size={15} />
            Open Upstox KYC Flow
          </button>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center mt-3">
            You will be redirected to Upstox to complete KYC
          </p>
        </motion.div>
      ) : (
        <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center">
          <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
            KYC Complete — No action needed
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ComplianceDetail = ({ type, onBack, onOpenKycFlow }: ComplianceDetailProps) => {
  const { user } = useAuthStore();
  const kycStatus = user?.kyc_status;

  const isKycHub = type === 'KYC & Compliance';

  const handleOpenKycFlow = () => {
    if (onOpenKycFlow) {
      onOpenKycFlow();
      return;
    }
    const url =
      kycStatus === 'not_started' || !kycStatus
        ? 'https://upstox.com/open-demat-account/'
        : 'https://upstox.com/login/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const staticData = staticContent[type] ?? { title: type, text: 'Information not available.' };

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 pt-12 px-6 pb-6">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-zinc-900 text-zinc-400 active:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-white">
            {isKycHub ? 'KYC & Compliance' : staticData.title}
          </h2>
          {isKycHub && (
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
              SEBI Regulated · Upstox Powered
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 space-y-4">
        {isKycHub ? (
          <KycHubScreen kycStatus={kycStatus} onOpenKycFlow={handleOpenKycFlow} />
        ) : (
          <>
            <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-8">
              <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                {staticData.text}
              </p>
            </div>
            <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-center">
                I have read and understood the disclosure
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComplianceDetail;