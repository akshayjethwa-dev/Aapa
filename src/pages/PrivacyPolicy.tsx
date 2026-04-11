import React from 'react';

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-black text-white p-8 md:p-16 max-w-4xl mx-auto selection:bg-emerald-500/30">
    <h1 className="text-3xl font-black text-emerald-500 mb-8 uppercase tracking-widest">Privacy Policy</h1>
    <div className="space-y-6 text-zinc-400 leading-relaxed">
      <p>Last Updated: April 2026</p>
      <section>
        <h2 className="text-xl font-bold text-white mb-2">1. Data Collection</h2>
        <p>We collect personal information necessary for KYC compliance, including PAN, Aadhaar, and Bank Account details as mandated by Indian financial regulations.</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-white mb-2">2. Broker Integration</h2>
        <p>When you connect your broker (Upstox, Angel One), we securely encrypt and store your access tokens to execute trades on your behalf. We do not sell your trading data.</p>
      </section>
    </div>
  </div>
);

export default PrivacyPolicy;