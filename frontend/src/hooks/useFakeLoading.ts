import { useEffect, useState } from 'react';

/** Simulates an async load so skeleton screens are shown briefly. */
export function useFakeLoading(deps: unknown[] = [], ms = 450): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return loading;
}
