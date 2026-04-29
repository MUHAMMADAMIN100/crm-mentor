import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('miz_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('miz_token');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/* =====================================================
   Lightweight in-memory cache for GET requests (SWR-like)
   ===================================================== */

interface CacheEntry<T = any> { data: T; ts: number; }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
const DEFAULT_TTL = 60_000;

function makeKey(url: string, params?: any) {
  if (!params) return url;
  const sorted = Object.keys(params).sort().reduce<any>((acc, k) => { acc[k] = params[k]; return acc; }, {});
  return url + '?' + JSON.stringify(sorted);
}

export function getCached<T = any>(url: string, params?: any): T | null {
  const e = cache.get(makeKey(url, params));
  return e ? (e.data as T) : null;
}

export async function fetchJson<T = any>(url: string, params?: any, ttl: number = DEFAULT_TTL): Promise<T> {
  const key = makeKey(url, params);
  if (inflight.has(key)) return inflight.get(key)! as Promise<T>;
  const p = api.get<T>(url, { params }).then((r) => {
    cache.set(key, { data: r.data, ts: Date.now() });
    inflight.delete(key);
    return r.data;
  }).catch((e) => {
    inflight.delete(key);
    throw e;
  });
  inflight.set(key, p);
  return p;
}

/** Invalidate cache entries by URL prefix. */
export function invalidateApi(prefix: string) {
  for (const k of Array.from(cache.keys())) {
    if (k === prefix || k.startsWith(prefix + '?') || k.startsWith(prefix)) cache.delete(k);
  }
}

export function invalidateAll() {
  cache.clear();
}
