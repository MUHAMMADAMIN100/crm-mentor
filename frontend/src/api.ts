import axios, { AxiosResponse } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('miz_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => {
    // Auto-cache successful GET responses for SWR navigation
    if (r.config.method?.toLowerCase() === 'get' && r.status === 200) {
      const key = makeKey(r.config.url || '', r.config.params);
      cache.set(key, { data: r.data, ts: Date.now() });
      const subs = subscribers.get(key);
      if (subs && subs.size) subs.forEach((cb) => { try { cb(r.data); } catch {} });
    }
    return r;
  },
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('miz_token');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/* =====================================================
   In-memory cache + pub/sub for instant SWR navigation
   ===================================================== */

interface CacheEntry<T = any> { data: T; ts: number; }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
const subscribers = new Map<string, Set<(data: any) => void>>();

function makeKey(url: string, params?: any): string {
  if (!params || (typeof params === 'object' && Object.keys(params).length === 0)) return url;
  const sorted = Object.keys(params).sort().reduce<Record<string, any>>((acc, k) => {
    acc[k] = params[k];
    return acc;
  }, {});
  return url + '?' + JSON.stringify(sorted);
}

export function getCached<T = any>(url: string, params?: any): T | null {
  const e = cache.get(makeKey(url, params));
  return e ? (e.data as T) : null;
}

export function setCached<T = any>(url: string, params: any, data: T) {
  const key = makeKey(url, params);
  cache.set(key, { data, ts: Date.now() });
  const subs = subscribers.get(key);
  if (subs) subs.forEach((cb) => { try { cb(data); } catch {} });
}

export function subscribeCache(url: string, params: any, cb: (data: any) => void): () => void {
  const key = makeKey(url, params);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)!.add(cb);
  return () => {
    const set = subscribers.get(key);
    if (!set) return;
    set.delete(cb);
    if (!set.size) subscribers.delete(key);
  };
}

/** Fires GET, dedupes parallel calls for same key, populates cache. */
export async function prefetch<T = any>(url: string, params?: any): Promise<T> {
  const key = makeKey(url, params);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = api.get<T>(url, { params })
    .then((r: AxiosResponse<T>) => {
      inflight.delete(key);
      return r.data;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

/** Invalidate cache by prefix (e.g. '/students' matches '/students' and '/students?...'). */
export function invalidateApi(prefix: string) {
  for (const k of Array.from(cache.keys())) {
    if (k === prefix || k.startsWith(prefix + '?') || k.startsWith(prefix + '/')) {
      cache.delete(k);
    }
  }
}

export function invalidateAll() {
  cache.clear();
}

/** Helper for optimistic mutation: patch the cached value in-place and notify subscribers. */
export function mutateCache<T = any>(url: string, params: any, updater: (prev: T | null) => T) {
  const prev = getCached<T>(url, params);
  const next = updater(prev);
  setCached(url, params, next);
}
