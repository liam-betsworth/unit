"use client";
import React from 'react';

// Simple animated variant: pulse status badge & subtle bracket drift
export function AnimatedLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        className="text-white animate-[pulse_3s_ease-in-out_infinite]"
        aria-label="Unit animated bracket"
      >
        <rect x="12" y="12" width="20" height="104" rx="6" fill="currentColor" />
        <rect x="96" y="12" width="20" height="104" rx="6" fill="currentColor" />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-agent-peacock animate-ping" />
    </div>
  );
}

export default AnimatedLogo;
