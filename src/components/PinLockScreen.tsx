import React, { useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerBiometricPrompt } from '../services/platform';
import { Logo } from './Logo';

export const PinLockScreen: React.FC = () => {
  const { settings, verifyPinCode, unlockBiometric, t } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleDigit = async (digit: string) => {
    if (checking || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      setChecking(true);
      const ok = await verifyPinCode(next);
      setChecking(false);
      if (!ok) {
        setError('Incorrect 4-digit PIN');
        setPin('');
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleBiometric = async () => {
    const ok = await triggerBiometricPrompt();
    if (ok) {
      unlockBiometric();
    } else {
      setError('Biometric verification failed or unavailable.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0B18] text-white p-6">
      <div className="w-full max-w-xs flex flex-col items-center">
        <Logo size={56} />
        <h1 className="mt-4 text-xl font-bold tracking-tight">CREDIT LOGGER</h1>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-300">
          <Lock className="w-3.5 h-3.5" />
          <span>{t('enterPin')}</span>
        </div>

        <div className="mt-6 flex items-center gap-4" aria-label="PIN progress">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                idx < pin.length
                  ? 'bg-violet-500 border-violet-400 scale-110'
                  : 'border-white/25 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-400 font-medium">{error}</p>}

        <div className="mt-7 grid grid-cols-3 gap-3 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-14 rounded-2xl bg-[#15152B] hover:bg-violet-600/25 border border-white/10 text-xl font-semibold font-mono-num active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          {settings.securityPreferences.biometricEnabled ? (
            <button
              type="button"
              onClick={handleBiometric}
              aria-label="Unlock with biometrics"
              className="h-14 rounded-2xl bg-[#15152B] hover:bg-violet-600/25 border border-white/10 flex items-center justify-center text-violet-400 active:scale-95 transition"
            >
              <Fingerprint className="w-6 h-6" />
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[#15152B] hover:bg-violet-600/25 border border-white/10 text-xl font-semibold font-mono-num active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace PIN digit"
            className="h-14 rounded-2xl bg-[#15152B] hover:bg-red-500/20 border border-white/10 flex items-center justify-center text-slate-300 active:scale-95 transition"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
