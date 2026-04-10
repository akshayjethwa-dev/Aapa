import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, ChevronRight } from 'lucide-react';

const ComplianceDetail = ({ type, onBack }: { type: string, onBack: () => void }) => {
  const content: Record<string, { title: string, text: string }> = {
    'SEBI Disclaimer': {
      title: 'SEBI Disclaimer',
      text: 'Investment in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.'
    },
    'Risk Disclosure': {
      title: 'Risk Disclosure',
      text: 'Trading in derivatives (Futures and Options) involves significant risk and is not suitable for all investors. 9 out of 10 individual traders in equity Futures and Options Segment, incurred net losses. On an average, loss makers registered net loss close to ₹50,000.'
    },
    'Terms & Conditions': {
      title: 'Terms & Conditions',
      text: 'By using Aapa Capital, you agree to our terms of service. We provide a platform for trading and do not provide financial advice. All trades are executed at your own risk. Brokerage and other charges apply as per the fee schedule.'
    }
  };

  const data = content[type] || { title: 'Compliance', text: 'Information not available.' };

  return (
    <div className="min-h-screen bg-black p-8 space-y-8 pb-24">
      <div className="flex items-center gap-4 pt-12">
        <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <h2 className="text-2xl font-black tracking-tighter text-white">{data.title}</h2>
      </div>
      <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-[2.5rem] p-8">
        <p className="text-sm text-zinc-400 leading-relaxed font-medium">{data.text}</p>
      </div>
      <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-center">I have read and understood the disclosure</p>
      </div>
    </div>
  );
};

export default ComplianceDetail;