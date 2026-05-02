import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useT } from '../i18n';

/**
 * Cmd+K / Ctrl+K global search overlay for admin: searches teachers,
 * students, courses and managers in parallel via /admin/search.
 */
export function GlobalSearch() {
  const { t } = useT();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hotkey
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    if (!open) { setQ(''); setResults(null); setActive(0); }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || !q.trim()) { setResults(null); return; }
    const tt = setTimeout(() => {
      api.get(`/admin/search?q=${encodeURIComponent(q)}`)
        .then((r) => { setResults(r.data); setActive(0); })
        .catch(() => setResults({ teachers: [], students: [], courses: [], managers: [] }));
    }, 180);
    return () => clearTimeout(tt);
  }, [q, open]);

  // Flatten results into a single navigable list
  const flat = results ? [
    ...results.teachers.map((x: any) => ({ kind: 'teacher', id: x.id, primary: x.fullName, secondary: x.login + (x.email ? ` · ${x.email}` : ''), to: `/admin/teachers/${x.id}` })),
    ...results.students.map((x: any) => ({ kind: 'student', id: x.id, primary: x.fullName, secondary: x.login + (x.email ? ` · ${x.email}` : ''), to: `/admin/students/${x.id}` })),
    ...results.courses.map((x: any) => ({ kind: 'course', id: x.id, primary: x.title, secondary: x.teacher?.fullName || '', to: `/admin/courses/${x.id}` })),
    ...results.managers.map((x: any) => ({ kind: 'manager', id: x.id, primary: x.fullName, secondary: `${x.adminLevel || ''} · ${x.login}`, to: `/admin/managers` })),
  ] : [];

  function go(item: any) {
    setOpen(false);
    nav(item.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active]); }
  }

  if (!open) return null;
  return createPortal(
    <div className="gsearch-overlay" onClick={() => setOpen(false)}>
      <div className="gsearch-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="gsearch-input"
          placeholder={t('admin.search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="gsearch-results">
          {!q.trim() && <div className="gsearch-empty">{t('admin.search.hint')}</div>}
          {q.trim() && results && flat.length === 0 && <div className="gsearch-empty">{t('admin.search.empty')}</div>}
          {results && results.teachers.length > 0 && (
            <>
              <div className="gsearch-section-title">{t('nav.teachers')}</div>
              {results.teachers.map((x: any, i: number) => {
                const idx = i;
                return (
                  <div key={x.id} className={`gsearch-item ${active === idx ? 'active' : ''}`} onClick={() => go({ to: `/admin/teachers/${x.id}` })}>
                    <div className="label">
                      <div className="primary">{x.fullName}</div>
                      <div className="secondary">{x.login}{x.email ? ` · ${x.email}` : ''}</div>
                    </div>
                    <span className="kind">teacher</span>
                  </div>
                );
              })}
            </>
          )}
          {results && results.students.length > 0 && (
            <>
              <div className="gsearch-section-title">{t('nav.students')}</div>
              {results.students.map((x: any, i: number) => {
                const idx = results.teachers.length + i;
                return (
                  <div key={x.id} className={`gsearch-item ${active === idx ? 'active' : ''}`} onClick={() => go({ to: `/admin/students/${x.id}` })}>
                    <div className="label">
                      <div className="primary">{x.fullName}</div>
                      <div className="secondary">{x.login}{x.email ? ` · ${x.email}` : ''}</div>
                    </div>
                    <span className="kind">student</span>
                  </div>
                );
              })}
            </>
          )}
          {results && results.courses.length > 0 && (
            <>
              <div className="gsearch-section-title">{t('nav.courses')}</div>
              {results.courses.map((x: any, i: number) => {
                const idx = results.teachers.length + results.students.length + i;
                return (
                  <div key={x.id} className={`gsearch-item ${active === idx ? 'active' : ''}`} onClick={() => go({ to: `/admin/courses/${x.id}` })}>
                    <div className="label">
                      <div className="primary">{x.title}</div>
                      <div className="secondary">{x.teacher?.fullName || ''}</div>
                    </div>
                    <span className="kind">course</span>
                  </div>
                );
              })}
            </>
          )}
          {results && results.managers.length > 0 && (
            <>
              <div className="gsearch-section-title">{t('nav.managers')}</div>
              {results.managers.map((x: any, i: number) => {
                const idx = results.teachers.length + results.students.length + results.courses.length + i;
                return (
                  <div key={x.id} className={`gsearch-item ${active === idx ? 'active' : ''}`} onClick={() => go({ to: `/admin/managers` })}>
                    <div className="label">
                      <div className="primary">{x.fullName}</div>
                      <div className="secondary">{x.adminLevel || ''} · {x.login}</div>
                    </div>
                    <span className="kind">manager</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="gsearch-footer">
          <span>↑↓ — навигация · Enter — открыть · Esc — закрыть</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
