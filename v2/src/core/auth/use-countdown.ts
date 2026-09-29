'use client';

// The "Resend code (0:42)" countdown: seconds left, and a start(seconds) to call when a code is sent. The one-second
// tick lives in core/ — the only place a timer is allowed (A2) — and stops at zero.
import { useEffect, useState } from 'react';

export function useCountdown(): [number, (seconds: number) => void] {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (until === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  const start = (seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  };
  return [until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000)), start];
}

/** 42 → "0:42", 75 → "1:15". */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
