import React from 'react';
import { cn } from '../lib/utils';
import { MarketPhase } from '../types';

export const MarketStatusPill = ({ phase }: { phase: MarketPhase }) => {
  if (!phase) return null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md border backdrop-blur-sm",
      phase === 'LIVE' ? "bg-emerald-500/10 border-emerald-500/20" :
      phase === 'PRE_OPEN' ? "bg-amber-500/10 border-amber-500/20" :
      "bg-zinc-800/50 border-zinc-700/50"
    )}>
      <div className="relative flex h-2 w-2">
        {phase === 'LIVE' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          phase === 'LIVE' ? "bg-emerald-500" :
          phase === 'PRE_OPEN' ? "bg-amber-500" :
          "bg-zinc-500"
        )}></span>
      </div>
      <span className={cn(
        "text-[9px] font-bold tracking-widest uppercase",
        phase === 'LIVE' ? "text-emerald-500" :
        phase === 'PRE_OPEN' ? "text-amber-500" :
        "text-zinc-400"
      )}>
        {phase === 'LIVE' ? 'LIVE - NSE' : 
         phase === 'PRE_OPEN' ? 'PRE-OPEN' : 
         'CLOSED'}
      </span>
    </div>
  );
};

export default MarketStatusPill;