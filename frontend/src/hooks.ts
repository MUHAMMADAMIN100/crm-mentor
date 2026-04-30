import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getCached, subscribeCache } from './api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  refetch: () => Promise<T | undefined>;
  setData: (next: T | ((prev: T | null) => T)) => void;
}

/**
 * SWR-style hook with three powers:
 *  1. Returns cached data synchronously on mount → no skeleton on revisit.
 *  2. Always revalidates in the background (fresh data lands silently).
 *  3. Subscribes to cache mutations from anywhere in the app — when another
 *     component updates the same URL via setCached/mutateCache, this view
 *     re-renders automatically.
 */
export function useApi<T = any>(url: string | null, params?: any): UseApiResult<T> {
  const cached = url ? getCached<T>(url, params) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState<boolean>(!cached && !!url);
  const [error, setError] = useState<any>(null);
  const ps = useRef<string>('');
  const psNew = JSON.stringify(params ?? null);

  const fetcher = useCallback(async () => {
    if (!url) return undefined;
    try {
      const r = await api.get<T>(url, { params });
      setError(null);
      // The response interceptor writes into cache & notifies subscribers,
      // which calls our setData below — no extra setData needed here.
      return r.data;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, psNew]);

  useEffect(() => {
    if (!url) return;
    if (ps.current !== psNew) {
      ps.current = psNew;
      const fresh = getCached<T>(url, params);
      if (fresh !== null && fresh !== undefined) {
        setData(fresh);
        setLoading(false);
      } else {
        setLoading(true);
      }
      fetcher().catch(() => {});
    }
    // Subscribe to cache changes so optimistic updates from other components
    // propagate here without an explicit refetch.
    const unsub = subscribeCache(url, params, (next) => setData(next));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, psNew]);

  return {
    data,
    loading,
    error,
    refetch: fetcher,
    setData: (next) => {
      setData((prev) => (typeof next === 'function' ? (next as any)(prev) : next));
    },
  };
}
