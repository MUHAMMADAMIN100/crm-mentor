import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store';
import { useState, ReactNode, useEffect } from 'react';

interface NavItem { to: string; label: string; ai?: boolean; icon?: ReactNode; }

const Icon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  group: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><circle cx="17" cy="9" r="3" /></svg>,
  msg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  fin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  cog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="12" rx="3" /><path d="M12 2v6" /><circle cx="12" cy="3" r="1" /></svg>,
  note: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
};

const NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { to: '/admin', label: 'Главное', icon: Icon.home },
    { to: '/admin/managers', label: 'Менеджеры', icon: Icon.shield },
    { to: '/admin/teachers', label: 'Учителя', icon: Icon.users },
    { to: '/admin/students', label: 'Ученики', icon: Icon.users },
    { to: '/admin/courses', label: 'Курсы', icon: Icon.book },
    { to: '/admin/finance', label: 'Финансы', icon: Icon.fin },
    { to: '/admin/analytics', label: 'Аналитика', icon: Icon.chart },
    { to: '/admin/system', label: 'Система', icon: Icon.cog },
    { to: '/notes', label: 'Заметки', icon: Icon.note },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Главное', icon: Icon.home },
    { to: '/teacher/calendar', label: 'Календарь', icon: Icon.cal },
    { to: '/teacher/students', label: 'Ученики', icon: Icon.users },
    { to: '/teacher/courses', label: 'Курсы', icon: Icon.book },
    { to: '/teacher/groups', label: 'Группы', icon: Icon.group },
    { to: '/teacher/messages', label: 'Сообщения', icon: Icon.msg },
    { to: '/teacher/finance', label: 'Финансы', icon: Icon.fin },
    { to: '/notes', label: 'Заметки', icon: Icon.note },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
  STUDENT: [
    { to: '/student', label: 'Главное', icon: Icon.home },
    { to: '/student/calendar', label: 'Календарь', icon: Icon.cal },
    { to: '/student/courses', label: 'Курсы', icon: Icon.book },
    { to: '/student/messages', label: 'Сообщения', icon: Icon.msg },
    { to: '/notes', label: 'Заметки', icon: Icon.note },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
};

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [loc.pathname]);

  if (!user) return null;
  const items = NAV[user.role] || [];

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop open" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo">Miz</div>
        <nav>
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/teacher' || i.to === '/student' || i.to === '/admin'}
              className={({ isActive }) => `${isActive ? 'active' : ''} ${i.ai ? 'ai-link' : ''}`}
            >
              {i.ai && <span className="ai-dot" />}
              {i.icon && <span className="nav-ico">{i.icon}</span>}
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Miz MVP · {new Date().getFullYear()}
        </div>
      </aside>
      <div>
        <header className="topbar">
          <div className="title-block">
            <button className="menu-toggle" aria-label="Открыть меню" onClick={() => setSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div className="title">{title}</div>
          </div>
          <div className="right">
            <span className="muted" style={{ fontSize: 13 }}>{user.fullName}</span>
            <div style={{ position: 'relative' }}>
              <div className="avatar" onClick={() => setMenuOpen((v) => !v)} aria-label="Меню пользователя">
                {user.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                  <div className="card" style={{ position: 'absolute', right: 0, top: 44, minWidth: 200, padding: 8, zIndex: 50 }}>
                    <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setMenuOpen(false); nav('/profile'); }}>Профиль</button>
                    <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setMenuOpen(false); nav('/settings'); }}>Настройки</button>
                    <div className="h-divider" />
                    <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', color: 'var(--danger)' }} onClick={logout}>Выйти</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="content" key={loc.pathname}>{children}</main>
      </div>
    </div>
  );
}
