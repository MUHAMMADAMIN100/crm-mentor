import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { useT } from '../../i18n';
import { StatusBadge, SortHeader, Paginator } from '../../components/AdminUI';

export function AdminCourses() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [format, setFormat] = useState('all');
  const [sort, setSort] = useState('-created');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const url = `/admin/courses?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(format !== 'all' ? { format } : {}),
    ...(sort ? { sort } : {}),
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data: response, loading } = useApi<any>(url);
  const list: any[] = response?.items || [];
  const total: number = response?.total || 0;

  // Pull format reference from system settings (initial values seeded by SystemService).
  const { data: settings } = useApi<any>('/admin/system/settings');
  let formats: string[] = ['online', 'offline', 'hybrid', 'mixed'];
  try { if (settings && typeof (settings as any)['ref.courseFormats'] === 'string') formats = JSON.parse((settings as any)['ref.courseFormats']); } catch {}

  return (
    <Shell title={t('nav.courses')}>
      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.fin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.filter.all')}</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED_PRIVATE">PUBLISHED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <select className="select" value={format} onChange={(e) => { setFormat(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.course.formatAny')}</option>
          {formats.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {!response && loading ? <SkeletonTable rows={5} cols={6} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <SortHeader field="title" label={t('course.title2')} sort={sort} onSort={setSort} />
                <th>{t('nav.teachers')}</th>
                <th>{t('admin.course.format')}</th>
                <th>{t('course.status')}</th>
                <SortHeader field="modules" label={t('admin.course.modules')} sort={sort} onSort={setSort} />
                <SortHeader field="students" label={t('course.studentsCount')} sort={sort} onSort={setSort} />
                <SortHeader field="updated" label={t('admin.fin.col.updated')} sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/courses/${c.id}`} style={{ fontWeight: 500 }}>{c.title}</Link>
                    {c.category && <div className="muted" style={{ fontSize: 11 }}>{c.category}</div>}
                  </td>
                  <td>{c.teacher
                    ? <Link to={`/admin/teachers/${c.teacher.id}`}>{c.teacher.fullName}</Link>
                    : '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{c.format || '—'}</td>
                  <td>
                    <StatusBadge status={c.status} />
                    {c.hidden && <span className="status-badge status-muted" style={{ marginLeft: 4 }}>{t('admin.course.hidden')}</span>}
                  </td>
                  <td>{c._count?.modules}</td>
                  <td>{c._count?.accesses}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(c.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="empty">{search || status !== 'all' ? t('empty.noFound') : t('empty.noCourses')}</td></tr>}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}
    </Shell>
  );
}
