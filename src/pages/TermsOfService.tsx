import React from 'react';

const TermsOfService = () => (
  <div className="min-h-screen bg-black text-white p-8 md:p-16 max-w-4xl mx-auto selection:bg-emerald-500/30">
    <h1 className="text-3xl font-black text-emerald-500 mb-8 uppercase tracking-widest">Terms of Service</h1>
    <div className="space-y-6 text-zinc-400 leading-relaxed">
      <p>Last Updated: April 2026</p>
      <section>
        <h2 className="text-xl font-bold text-white mb-2">1. Acceptance of Terms</h2>
        <p>By accessing and using Aapa Capital, you accept and agree to be bound by the terms and provision of this agreement.</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-white mb-2">2. Use of Platform</h2>
        <p>You agree to use this platform strictly for lawful trading and investment purposes. Any unauthorized use, market manipulation, or abuse of the API will result in immediate account termination.</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-white mb-2">3. Account Security</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and broker API tokens.</p>
      </section>
    </div>
  </div>
);

export default TermsOfService;