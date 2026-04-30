import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store';
import { useState, ReactNode, useEffect, useRef } from 'react';
import { prefetch } from '../api';
import { useT, useI18n, LANG_OPTIONS, Lang } from '../i18n';

const PREFETCH_MAP: Record<string, () => void> = {
  '/admin':            () => prefetch('/admin/analytics'),
  '/admin/teachers':   () => prefetch('/admin/teachers'),
  '/admin/students':   () => prefetch('/admin/students'),
  '/admin/courses':    () => prefetch('/admin/courses'),
  '/admin/finance':    () => prefetch('/admin/finance'),
  '/admin/analytics':  () => prefetch('/admin/analytics'),
  '/teacher':          () => prefetch('/teacher/dashboard'),
  '/teacher/students': () => prefetch('/students'),
  '/teacher/courses':  () => prefetch('/courses'),
  '/teacher/groups':   () => prefetch('/groups'),
  '/teacher/finance':  () => prefetch('/finance/teacher'),
  '/teacher/messages': () => prefetch('/chat'),
  '/student':          () => prefetch('/students/me/dashboard'),
  '/student/courses':  () => prefetch('/courses/me/list'),
  '/student/messages': () => prefetch('/chat'),
  '/notes':            () => prefetch('/notes'),
  '/ai':               () => prefetch('/ai/suggestions'),
};
function prefetchRoute(to: string) {
  const fn = PREFETCH_MAP[to];
  if (fn) { try { fn(); } catch {} }
}

interface NavItem { to: string; labelKey: any; ai?: boolean; icon?: ReactNode; }

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
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
};

const NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { to: '/admin', labelKey: 'nav.home', icon: Icon.home },
    { to: '/admin/managers', labelKey: 'nav.managers', icon: Icon.shield },
    { to: '/admin/teachers', labelKey: 'nav.teachers', icon: Icon.users },
    { to: '/admin/students', labelKey: 'nav.students', icon: Icon.users },
    { to: '/admin/courses', labelKey: 'nav.courses', icon: Icon.book },
    { to: '/admin/finance', labelKey: 'nav.finance', icon: Icon.fin },
    { to: '/admin/analytics', labelKey: 'nav.analytics', icon: Icon.chart },
    { to: '/admin/system', labelKey: 'nav.system', icon: Icon.cog },
    { to: '/ai', labelKey: 'nav.ai', ai: true },
  ],
  TEACHER: [
    { to: '/teacher', labelKey: 'nav.home', icon: Icon.home },
    { to: '/teacher/calendar', labelKey: 'nav.calendar', icon: Icon.cal },
    { to: '/teacher/students', labelKey: 'nav.students', icon: Icon.users },
    { to: '/teacher/courses', labelKey: 'nav.courses', icon: Icon.book },
    { to: '/teacher/groups', labelKey: 'nav.groups', icon: Icon.group },
    { to: '/teacher/messages', labelKey: 'nav.messages', icon: Icon.msg },
    { to: '/teacher/finance', labelKey: 'nav.finance', icon: Icon.fin },
    { to: '/ai', labelKey: 'nav.ai', ai: true },
  ],
  STUDENT: [
    { to: '/student', labelKey: 'nav.home', icon: Icon.home },
    { to: '/student/calendar', labelKey: 'nav.calendar', icon: Icon.cal },
    { to: '/student/courses', labelKey: 'nav.courses', icon: Icon.book },
    { to: '/student/messages', labelKey: 'nav.messages', icon: Icon.msg },
    { to: '/ai', labelKey: 'nav.ai', ai: true },
  ],
};

const ROOT_PATHS = new Set(['/admin', '/teacher', '/student']);

export function Shell({ title, children, showBack }: { title: string; children: ReactNode; showBack?: boolean }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSidebarOpen(false); setMenuOpen(false); }, [loc.pathname]);

  // Close avatar menu on any click outside it
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!user) return null;
  const items = NAV[user.role] || [];

  // Determine if "Back" button should be shown:
  // explicit prop wins, otherwise show on any non-root path that's not home of user role.
  const isRootPath =
    loc.pathname === '/' ||
    loc.pathname === '/admin' ||
    loc.pathname === '/teacher' ||
    loc.pathname === '/student' ||
    items.some((i) => i.to === loc.pathname && ROOT_PATHS.has(i.to));
  const showBackBtn = showBack ?? !isRootPath;

  function handleBack() {
    if (window.history.length > 1) nav(-1);
    else if (user) {
      if (user.role === 'ADMIN') nav('/admin');
      else if (user.role === 'TEACHER') nav('/teacher');
      else nav('/student');
    }
  }

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
              end={ROOT_PATHS.has(i.to)}
              className={({ isActive }) => `${isActive ? 'active' : ''} ${i.ai ? 'ai-link' : ''}`}
              onMouseEnter={() => prefetchRoute(i.to)}
              onTouchStart={() => prefetchRoute(i.to)}
            >
              {i.ai && <span className="ai-dot" />}
              {i.icon && <span className="nav-ico">{i.icon}</span>}
              <span>{t(i.labelKey)}</span>
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
            <button className="menu-toggle" aria-label={t('nav.openMenu')} onClick={() => setSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            {showBackBtn && (
              <button className="back-btn" aria-label={t('btn.back')} onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                <span className="back-btn-label">{t('btn.back')}</span>
              </button>
            )}
            <div className="title">{title}</div>
          </div>
          <div className="right">
            <LangPicker lang={lang} setLang={setLang} />
            <span className="muted user-name-label" style={{ fontSize: 13 }}>{user.fullName}</span>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <div className="avatar" onClick={() => setMenuOpen((v) => !v)} aria-label={t('nav.userMenu')}>
                {user.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              {menuOpen && (
                <div className="avatar-menu">
                  <button className="avatar-menu-item" onClick={() => { setMenuOpen(false); nav('/profile'); }}>{t('menu.profile')}</button>
                  <button className="avatar-menu-item" onClick={() => { setMenuOpen(false); nav('/settings'); }}>{t('menu.settings')}</button>
                  <div className="avatar-menu-divider" />
                  <button className="avatar-menu-item danger" onClick={logout}>{t('menu.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content" key={loc.pathname}>{children}</main>
      </div>
    </div>
  );
}

function LangPicker({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = LANG_OPTIONS.find((o) => o.code === lang) || LANG_OPTIONS[0];
  return (
    <div className="lang-picker" ref={wrap}>
      <button className="lang-trigger" onClick={() => setOpen((v) => !v)} aria-label="Language">
        <span className="lang-flag">{current.flag}</span>
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="lang-menu">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              className={`lang-option ${lang === opt.code ? 'active' : ''}`}
              onClick={() => { setLang(opt.code as Lang); setOpen(false); }}
            >
              <span className="lang-flag" aria-hidden>{opt.flag}</span>
              <span className="lang-label">{opt.label}</span>
              <span className="lang-code-mini">{opt.code.toUpperCase()}</span>
              {lang === opt.code && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
