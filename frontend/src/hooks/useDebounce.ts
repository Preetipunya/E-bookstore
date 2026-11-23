import { useEffect, useState } from 'react';

/** Debounces a fast-changing value (e.g. a search box). */
export function useDebounce<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}
