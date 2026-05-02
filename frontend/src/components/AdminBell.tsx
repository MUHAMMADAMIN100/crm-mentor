import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useT } from '../i18n';

/**
 * Admin-only bell in the topbar. Polls /admin/notifications every 60s
 * and surfaces operational alerts: subscriptions expiring/expired,
 * new sign-ups in the last 24h, recent payments.
 */
export function AdminBell() {
  const { t } = useT();
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  function load() {
    api.get('/admin/notifications').then((r) => setData(r.data)).catch(() => {});
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const total = data?.total || 0;

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button className="admin-bell" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && <span className="bell-dot">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && data && (
        <div className="admin-bell-menu">
          {data.expiringSoon?.length > 0 && (
            <>
              <div className="admin-bell-section">{t('admin.bell.expiring')} ({data.expiringSoon.length})</div>
              {data.expiringSoon.map((s: any) => (
                <Link key={s.id} to={`/admin/teachers/${s.teacher?.id || s.teacherId}`} className="admin-bell-item" onClick={() => setOpen(false)}>
                  <div className="primary">{s.teacher?.fullName || s.teacherId}</div>
                  <div className="secondary">{t('admin.attention.until')} {new Date(s.endDate).toLocaleDateString()}</div>
                </Link>
              ))}
            </>
          )}
          {data.expired?.length > 0 && (
            <>
              <div className="admin-bell-section">{t('admin.bell.expired')} ({data.expired.length})</div>
              {data.expired.map((s: any) => (
                <Link key={s.id} to={`/admin/teachers/${s.teacher?.id || s.teacherId}`} className="admin-bell-item" onClick={() => setOpen(false)}>
                  <div className="primary">{s.teacher?.fullName || s.teacherId}</div>
                  <div className="secondary" style={{ color: 'var(--danger)' }}>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</div>
                </Link>
              ))}
            </>
          )}
          {data.newTeachers24h?.length > 0 && (
            <>
              <div className="admin-bell-section">{t('admin.bell.newTeachers')} ({data.newTeachers24h.length})</div>
              {data.newTeachers24h.map((u: any) => (
                <Link key={u.id} to={`/admin/teachers/${u.id}`} className="admin-bell-item" onClick={() => setOpen(false)}>
                  <div className="primary">{u.fullName}</div>
                  <div className="secondary">{u.login} · {new Date(u.createdAt).toLocaleString()}</div>
                </Link>
              ))}
            </>
          )}
          {data.newStudents24h?.length > 0 && (
            <>
              <div className="admin-bell-section">{t('admin.bell.newStudents')} ({data.newStudents24h.length})</div>
              {data.newStudents24h.map((u: any) => (
                <Link key={u.id} to={`/admin/students/${u.id}`} className="admin-bell-item" onClick={() => setOpen(false)}>
                  <div className="primary">{u.fullName}</div>
                  <div className="secondary">{u.login}</div>
                </Link>
              ))}
            </>
          )}
          {data.recentPayments?.length > 0 && (
            <>
              <div className="admin-bell-section">{t('admin.bell.recentPayments')} ({data.recentPayments.length})</div>
              {data.recentPayments.map((h: any) => (
                <Link key={h.id} to={`/admin/teachers/${h.subscription?.teacher?.id}`} className="admin-bell-item" onClick={() => setOpen(false)}>
                  <div className="primary">{h.subscription?.teacher?.fullName || '—'}</div>
                  <div className="secondary">{h.action} · {h.amount ? `${h.amount.toLocaleString()} ₽` : ''} · {h.actor?.fullName || ''}</div>
                </Link>
              ))}
            </>
          )}
          {total === 0 && (
            <div className="admin-bell-empty">{t('admin.bell.empty')}</div>
          )}
        </div>
      )}
    </div>
  );
}
