import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { useT } from '../../i18n';
import { SortHeader, Paginator } from '../../components/AdminUI';

export function AdminAudit() {
  const { t } = useT();
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const url = `/admin/audit?${new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort,
    ...(action ? { action } : {}),
  }).toString()}`;
  const { data, loading } = useApi<any>(url);
  const items: any[] = data?.items || [];
  const total: number = data?.total || 0;

  const filtered = items.filter((a: any) => {
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
        <select className="select" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}>
          <option value="">{t('admin.audit.allActions')}</option>
          <option value="teacher.">teacher.*</option>
          <option value="student.">student.*</option>
          <option value="manager.">manager.*</option>
          <option value="subscription.">subscription.*</option>
          <option value="course.">course.*</option>
          <option value="bulk.">bulk.*</option>
          <option value="system.">system.*</option>
          <option value="security.">security.*</option>
          <option value="ai.">ai.*</option>
        </select>
      </div>

      {loading && !data ? <div className="card"><div className="muted">{t('status.loading')}</div></div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <SortHeader field="action" label={t('admin.analytics.action')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th>{t('profile.fullName')}</th>
                <th>{t('admin.audit.target')}</th>
                <SortHeader field="createdAt" label={t('admin.audit.when')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="empty">{t('admin.audit.empty')}</td></tr>
              )}
              {filtered.map((a: any) => (
                <tr key={a.id}>
                  <td><span className="audit-action">{a.action}</span></td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.actor?.fullName || '—'}</div>
                    {a.actor?.adminLevel && <div className="muted" style={{ fontSize: 11 }}>[{a.actor.adminLevel}]</div>}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {a.targetType && a.targetId && <span>{a.targetType}:{a.targetId.slice(0, 12)}…</span>}
                    {a.meta && Object.keys(a.meta).length > 0 && <div style={{ marginTop: 2 }}>{JSON.stringify(a.meta).slice(0, 80)}</div>}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}
    </Shell>
  );
}
