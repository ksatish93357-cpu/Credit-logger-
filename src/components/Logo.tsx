import React, { useId } from 'react';

export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <rect
        x="14"
        y="11"
        width="36"
        height="42"
        rx="5"
        fill="rgba(11,11,24,0.42)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      />
      <rect x="14" y="11" width="7" height="42" rx="3" fill="rgba(255,255,255,0.18)" />
      <path
        d="M27 21H42M27 27.5H42M28.5 21C34 21 37 23.2 37 27.2C37 31.2 33.8 33.5 28 33.5H27L39.5 45.5"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
