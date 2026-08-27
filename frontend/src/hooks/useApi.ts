import { useCallback, useEffect, useRef, useState } from "react";

export interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Declarative data loader. Returns loading/error/data for the three required
 * UI states. The fetcher is kept fresh via a ref that is synced in an effect
 * (not during render, per React's rules); `deps` is serialized to a stable
 * string key so the effect only re-runs when deps actually change. State is
 * only ever updated inside promise callbacks.
 */
export function useApi<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fnRef = useRef(fn);
  // Keep the latest fetcher without touching the ref during render.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const depsKey = JSON.stringify(deps);

  const run = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
      })
      .then(() => fnRef.current())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  useEffect(() => {
    const cleanup = run();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [run]);

  return { data, error, loading, refetch: run };
}
