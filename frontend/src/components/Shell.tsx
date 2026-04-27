import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store';
import { useState, ReactNode } from 'react';

interface NavItem { to: string; label: string; ai?: boolean; }
const NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { to: '/admin', label: 'Главное' },
    { to: '/admin/managers', label: 'Менеджеры' },
    { to: '/admin/teachers', label: 'Учителя' },
    { to: '/admin/students', label: 'Ученики' },
    { to: '/admin/courses', label: 'Курсы' },
    { to: '/admin/finance', label: 'Финансы' },
    { to: '/admin/analytics', label: 'Аналитика' },
    { to: '/admin/system', label: 'Система' },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Главное' },
    { to: '/teacher/calendar', label: 'Календарь' },
    { to: '/teacher/students', label: 'Ученики' },
    { to: '/teacher/courses', label: 'Курсы' },
    { to: '/teacher/groups', label: 'Группы' },
    { to: '/teacher/messages', label: 'Сообщения' },
    { to: '/teacher/finance', label: 'Финансы' },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
  STUDENT: [
    { to: '/student', label: 'Главное' },
    { to: '/student/calendar', label: 'Календарь' },
    { to: '/student/courses', label: 'Курсы' },
    { to: '/student/messages', label: 'Сообщения' },
    { to: '/ai', label: 'ИИ-помощник', ai: true },
  ],
};

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return null;
  const items = NAV[user.role] || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Miz MVP · {new Date().getFullYear()}
        </div>
      </aside>
      <div>
        <header className="topbar">
          <div className="title">{title}</div>
          <div className="right">
            <span className="muted" style={{ fontSize: 13 }}>{user.fullName}</span>
            <div style={{ position: 'relative' }}>
              <div className="avatar" onClick={() => setMenuOpen((v) => !v)}>
                {user.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              {menuOpen && (
                <div className="card" style={{ position: 'absolute', right: 0, top: 44, minWidth: 200, padding: 8, zIndex: 50 }}>
                  <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setMenuOpen(false); nav('/profile'); }}>Профиль</button>
                  <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setMenuOpen(false); nav('/settings'); }}>Настройки</button>
                  <div className="h-divider" />
                  <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', color: 'var(--danger)' }} onClick={logout}>Выйти</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
