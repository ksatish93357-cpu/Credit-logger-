import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDDMMYYYY, parseDDMMYYYYToISO } from '../utils/format';

interface DateInputProps {
  id?: string;
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  required?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({ id, label, value, onChange, required = false }) => {
  const [textVal, setTextVal] = useState(formatDateDDMMYYYY(value));
  const [error, setError] = useState('');

  useEffect(() => {
    setTextVal(formatDateDDMMYYYY(value));
    setError('');
  }, [value]);

  const handleManualChange = (raw: string) => {
    setTextVal(raw);
    if (raw.length === 10) {
      const iso = parseDDMMYYYYToISO(raw);
      if (iso) {
        setError('');
        onChange(iso);
      } else {
        setError('Use valid DD/MM/YYYY');
      }
    } else if (raw.length === 0) {
      setError('');
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/YYYY"
            value={textVal}
            onChange={(e) => handleManualChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
            DD/MM/YYYY
          </span>
        </div>
        <div className="relative flex items-center">
          <Calendar className="w-4 h-4 text-violet-500 absolute left-3 pointer-events-none" />
          <input
            type="date"
            aria-label={`${label} calendar picker`}
            value={value}
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value);
              }
            }}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
