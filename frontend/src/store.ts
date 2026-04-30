import { create } from 'zustand';
import { api } from './api';

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export interface CurrentUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
  mustChangePassword?: boolean;
  studentProfile?: any;
  teacherSubscription?: any;
  teacherCurrency?: string;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (login: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  async bootstrap() {
    const token = localStorage.getItem('miz_token');
    if (!token) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const r = await api.get<CurrentUser>('/auth/me');
      set({ user: r.data, loading: false });
    } catch {
      localStorage.removeItem('miz_token');
      set({ user: null, loading: false });
    }
  },
  async login(login, password) {
    const r = await api.post('/auth/login', { login, password });
    localStorage.setItem('miz_token', r.data.token);
    set({ user: r.data.user });
    return r.data.user as CurrentUser;
  },
  logout() {
    localStorage.removeItem('miz_token');
    sessionStorage.removeItem('miz_ai_history');
    try { import('./components/Chat').then((m) => m.disconnectChatSocket?.()); } catch {}
    set({ user: null });
    location.href = '/login';
  },
  async refreshMe() {
    const r = await api.get<CurrentUser>('/auth/me');
    set({ user: r.data });
  },
}));

/* =====================================================
   UI store: toasts, confirm dialogs (replacement for alert/confirm)
   ===================================================== */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  body: string;
  ttl?: number;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  body?: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIState {
  toasts: Toast[];
  confirms: ConfirmRequest[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: number) => void;
  confirm: (opts: Omit<ConfirmRequest, 'id' | 'resolve'>) => Promise<boolean>;
  resolveConfirm: (id: number, ok: boolean) => void;
}

let _uid = 1;

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  confirms: [],
  pushToast(t) {
    // Deduplicate: if a toast with the same kind+body already exists, skip.
    const dup = get().toasts.find((x) => x.kind === t.kind && x.body === t.body);
    if (dup) return;
    const id = _uid++;
    const toast: Toast = { id, ttl: 4000, ...t };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (toast.ttl) setTimeout(() => get().removeToast(id), toast.ttl);
  },
  removeToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  confirm(opts) {
    return new Promise<boolean>((resolve) => {
      const id = _uid++;
      set((s) => ({ confirms: [...s.confirms, { id, resolve, ...opts }] }));
    });
  },
  resolveConfirm(id, ok) {
    const item = get().confirms.find((c) => c.id === id);
    if (item) item.resolve(ok);
    set((s) => ({ confirms: s.confirms.filter((c) => c.id !== id) }));
  },
}));

/* shortcuts */
export const toast = {
  success: (body: string, title?: string) => useUI.getState().pushToast({ kind: 'success', body, title }),
  error: (body: string, title?: string) => useUI.getState().pushToast({ kind: 'error', body, title, ttl: 6000 }),
  info: (body: string, title?: string) => useUI.getState().pushToast({ kind: 'info', body, title }),
  warning: (body: string, title?: string) => useUI.getState().pushToast({ kind: 'warning', body, title }),
};

export function confirmDialog(opts: Omit<ConfirmRequest, 'id' | 'resolve'>) {
  return useUI.getState().confirm(opts);
}

/* =====================================================
   AI assistant context — persisted in sessionStorage
   ===================================================== */
export interface AiMessage { role: 'user' | 'assistant'; content: string; }

interface AIState {
  messages: AiMessage[];
  model: string;
  setMessages: (m: AiMessage[]) => void;
  setModel: (m: string) => void;
  clear: () => void;
}

function loadAi(): { messages: AiMessage[]; model: string } {
  try {
    const raw = sessionStorage.getItem('miz_ai_history');
    if (!raw) return { messages: [], model: '' };
    const j = JSON.parse(raw);
    return { messages: Array.isArray(j.messages) ? j.messages : [], model: j.model || '' };
  } catch {
    return { messages: [], model: '' };
  }
}
function saveAi(messages: AiMessage[], model: string) {
  try {
    sessionStorage.setItem('miz_ai_history', JSON.stringify({ messages, model }));
  } catch {}
}

export const useAi = create<AIState>((set) => {
  const init = loadAi();
  return {
    messages: init.messages,
    model: init.model,
    setMessages(m) { set((s) => { saveAi(m, s.model); return { messages: m }; }); },
    setModel(m) { set((s) => { saveAi(s.messages, m); return { model: m }; }); },
    clear() { saveAi([], ''); set({ messages: [], model: '' }); },
  };
});
