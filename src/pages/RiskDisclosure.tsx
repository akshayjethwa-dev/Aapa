import React from 'react';

const RiskDisclosure = () => (
  <div className="min-h-screen bg-black text-white p-8 md:p-16 max-w-4xl mx-auto selection:bg-emerald-500/30">
    <h1 className="text-3xl font-black text-emerald-500 mb-8 uppercase tracking-widest">Risk Disclosure</h1>
    <div className="space-y-6 text-zinc-400 leading-relaxed">
      <p className="font-bold text-amber-500 border border-amber-500/30 bg-amber-500/10 p-4 rounded-xl">
        Investment in securities market is subject to market risks. Read all scheme-related documents carefully before investing.
      </p>
      <ul className="list-disc pl-5 space-y-4">
        <li>Past performance is not indicative of future results.</li>
        <li>Aapa Capital is a technology platform and not a SEBI-registered investment advisor or broker-dealer.</li>
        <li>Options trading (F&O) carries a high degree of risk. 9 out of 10 individual traders in the equity F&O segment incur net losses.</li>
        <li>Simulated (Demo) prices may differ from real market prices. Never base real-world financial decisions on demo mode data.</li>
      </ul>
    </div>
  </div>
);

export default RiskDisclosure;