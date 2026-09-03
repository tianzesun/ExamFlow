"use client";

import { useEffect, useRef, useState } from "react";

interface NumberTickerProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

/**
 * Animated numeric counter with a digit-scroll feel, driven by
 * requestAnimationFrame. Falls back to an immediate set when the user prefers
 * reduced motion. State transitions live in rAF callbacks (not the effect body)
 * so React's render-purity rules are satisfied.
 */
export function NumberTicker({
  value,
  duration = 1.6,
  suffix,
  prefix,
  className = "",
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Keep a ref of the last painted value so each new animation starts from it.
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const startVal = displayRef.current;
    const delta = value - startVal;

    if (prefersReduced || delta === 0) {
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }

    const startTime = performance.now();
    let done = false;
    const step = (now: number) => {
      if (done) return;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / (duration * 1000));
      // easeOutCubic gives the scroll a decelerating tail.
      const progress = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + delta * progress));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };
    const raf = requestAnimationFrame(step);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [value, duration, prefersReduced]);

  return (
    <span
      className={`tnum ${className}`}
      aria-label={typeof value === "number" ? String(value) : undefined}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
