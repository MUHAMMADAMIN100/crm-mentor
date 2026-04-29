import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getCached } from './api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  refetch: () => void;
}

/**
 * SWR-style hook: returns cached data instantly if available, then revalidates in background.
 * Makes navigation feel instant on subsequent visits.
 */
export function useApi<T = any>(url: string | null, params?: any): UseApiResult<T> {
  const cached = url ? getCached<T>(url, params) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState<boolean>(!cached && !!url);
  const [error, setError] = useState<any>(null);
  const stableParams = useRef<string>('');
  const ps = JSON.stringify(params ?? null);

  const fetcher = useCallback(() => {
    if (!url) return;
    api.get<T>(url, { params })
      .then((r) => { setData(r.data); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ps]);

  useEffect(() => {
    if (!url) return;
    if (stableParams.current !== ps) {
      stableParams.current = ps;
      const fresh = getCached<T>(url, params);
      if (fresh) {
        setData(fresh);
        setLoading(false);
      } else {
        setLoading(true);
      }
      fetcher();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ps]);

  return { data, loading, error, refetch: fetcher };
}
