import { useEffect, useState } from "react";

/**
 * Returns a live timestamp that updates on an interval so time-relative UIs
 * (countdowns, relative dates) refresh without re-rendering the world.
 * The impure `Date.now()` call lives only inside the effect/callback, keeping
 * components pure per React's render rules.
 */
export function useNow(refreshMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return now;
}
