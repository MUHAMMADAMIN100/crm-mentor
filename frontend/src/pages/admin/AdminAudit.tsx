import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { useT } from '../../i18n';

export function AdminAudit() {
  const { t } = useT();
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const url = `/admin/audit?limit=200${action ? `&action=${encodeURIComponent(action)}` : ''}`;
  const { data, loading } = useApi<any[]>(url);

  const filtered = (data || []).filter((a: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (a.action || '').toLowerCase().includes(q)
      || (a.actor?.fullName || '').toLowerCase().includes(q)
      || (a.targetId || '').toLowerCase().includes(q);
  });

  return (
    <Shell title={t('admin.audit.title')}>
      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.audit.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t('admin.audit.allActions')}</option>
          <option value="teacher.">teacher.*</option>
          <option value="student.">student.*</option>
          <option value="manager.">manager.*</option>
          <option value="subscription.">subscription.*</option>
          <option value="course.">course.*</option>
          <option value="bulk.">bulk.*</option>
          <option value="system.">system.*</option>
        </select>
      </div>

      {loading && !data ? <div className="card"><div className="muted">{t('status.loading')}</div></div> : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.length === 0
            ? <div className="empty" style={{ padding: 24 }}>{t('admin.audit.empty')}</div>
            : filtered.map((a: any) => (
                <div key={a.id} className="audit-row">
                  <span className="audit-action">{a.action}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.actor?.fullName || '—'}</div>
                    <div className="audit-target">
                      {a.actor?.adminLevel && <span style={{ marginRight: 6 }}>[{a.actor.adminLevel}]</span>}
                      {a.targetType && a.targetId && <span>{a.targetType}:{a.targetId.slice(0, 12)}…</span>}
                      {a.meta && Object.keys(a.meta).length > 0 && <span style={{ marginLeft: 6 }}>· {JSON.stringify(a.meta).slice(0, 80)}</span>}
                    </div>
                  </div>
                  <span className="audit-time">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
        </div>
      )}
    </Shell>
  );
}
