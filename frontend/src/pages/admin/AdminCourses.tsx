import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { useT } from '../../i18n';
import { StatusBadge } from '../../components/AdminUI';

export function AdminCourses() {
  const { t } = useT();
  const { data: list, loading } = useApi<any[]>('/admin/courses');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'PUBLISHED_PRIVATE' | 'ARCHIVED'>('ALL');

  const visible = useMemo(() => {
    if (!list) return [];
    let v = list.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      v = v.filter((c: any) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.teacher?.fullName || '').toLowerCase().includes(q),
      );
    }
    if (status !== 'ALL') v = v.filter((c: any) => c.status === status);
    return v;
  }, [list, search, status]);

  return (
    <Shell title={t('nav.courses')}>
      <div className="fin-toolbar" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍 Поиск по названию / категории / учителю" style={{ maxWidth: 360 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="ALL">Все ({list?.length ?? 0})</option>
          <option value="DRAFT">Черновики</option>
          <option value="PUBLISHED_PRIVATE">Опубликованы</option>
          <option value="ARCHIVED">Архив</option>
        </select>
      </div>

      {!list && loading ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('course.title2')}</th><th>{t('nav.teachers')}</th><th>{t('course.status')}</th><th>{t('course.modules')}</th><th>{t('course.studentsCount')}</th></tr></thead>
            <tbody>
              {visible.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/courses/${c.id}`} style={{ fontWeight: 500 }}>{c.title}</Link>
                    {c.category && <div className="muted" style={{ fontSize: 11 }}>{c.category}</div>}
                  </td>
                  <td>{c.teacher
                    ? <Link to={`/admin/teachers/${c.teacher.id}`}>{c.teacher.fullName}</Link>
                    : '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c._count?.modules}</td><td>{c._count?.accesses}</td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={5} className="empty">{search || status !== 'ALL' ? t('empty.noFound') : t('empty.noCourses')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
