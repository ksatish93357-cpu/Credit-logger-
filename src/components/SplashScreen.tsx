import React from 'react';
import { Logo } from './Logo';

export const SplashScreen: React.FC<{ onContinue: () => void }> = ({ onContinue }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0B18] text-white px-6"
      role="status"
      aria-label="Loading CREDIT LOGGER"
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="p-4 rounded-3xl bg-[#15152B] border border-violet-500/30 shadow-2xl shadow-violet-950/50">
          <Logo size={72} />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">CREDIT LOGGER</h1>
        <p className="mt-2 text-sm text-violet-300/90">
          Universal Credit, Calendar Interest &amp; Payment Ledger
        </p>
        <div className="mt-8 w-44 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-violet-500 to-purple-400 animate-pulse rounded-full" />
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 text-xs text-slate-400 hover:text-white underline underline-offset-4"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
