import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const COUNT_MS = 700;

// Counts a score towards its new value instead of jumping, and reports the
// change (`delta`) for a short while so it can be shown as "+500" / "−300".
export function useScoreChange(score) {
  const [display, setDisplay] = useState(score);
  const [delta, setDelta] = useState(null);
  const shown = useRef(score);
  const target = useRef(score);

  useEffect(() => {
    const from = target.current;
    target.current = score;
    if (from === score) return;
    setDelta({ value: score - from, id: `${Date.now()}-${score}` });

    if (prefersReducedMotion()) {
      shown.current = score;
      setDisplay(score);
      return;
    }
    // Start from what is on screen, so a second change mid-count stays smooth.
    const start = shown.current;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      const eased = 1 - Math.pow(1 - p, 4);
      shown.current = Math.round(start + (score - start) * eased);
      setDisplay(shown.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  useEffect(() => {
    if (!delta) return;
    const id = setTimeout(() => setDelta(null), 1800);
    return () => clearTimeout(id);
  }, [delta]);

  return { display, delta };
}

export function formatDelta(value) {
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}
