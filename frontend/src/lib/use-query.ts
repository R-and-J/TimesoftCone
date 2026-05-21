// Minimal fetch-on-mount hook. Not a full TanStack-Query replacement —
// just enough for our 3 connected screens. Has a `refetch()` so the bid
// success handler can refresh the detail view.

import { useCallback, useEffect, useRef, useState } from "react";

export type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useQuery<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest fn in a ref so refetch always uses the freshest closure
  // without forcing dependents to wrap fn in useCallback.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}
