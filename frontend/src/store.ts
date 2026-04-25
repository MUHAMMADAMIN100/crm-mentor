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
    set({ user: null });
    location.href = '/login';
  },
  async refreshMe() {
    const r = await api.get<CurrentUser>('/auth/me');
    set({ user: r.data });
  },
}));
