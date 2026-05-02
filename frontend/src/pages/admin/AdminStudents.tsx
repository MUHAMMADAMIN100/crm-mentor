import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge } from '../../components/AdminUI';

type StatusFilter = 'ALL' | 'active' | 'archived';

export function AdminStudents() {
  const { t } = useT();
  const { data: list, loading } = useApi<any[]>('/admin/students');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const visible = useMemo(() => {
    if (!list) return [];
    let v = list.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      v = v.filter((u: any) =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.login || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.studentProfile?.teacher?.fullName || '').toLowerCase().includes(q),
      );
    }
    if (filter === 'active') v = v.filter((u: any) => !u.archived);
    else if (filter === 'archived') v = v.filter((u: any) => u.archived);
    return v;
  }, [list, search, filter]);

  async function archive(id: string, archived: boolean) {
    const prev = list || [];
    mutateCache<any[]>('/admin/students', undefined, (cur) =>
      (cur || []).map((s) => s.id === id ? { ...s, archived: !archived } : s),
    );
    try {
      if (archived) await api.patch(`/admin/users/${id}/unarchive`);
      else await api.patch(`/admin/users/${id}/archive`);
      invalidateApi('/admin/students');
      toast.success(archived ? t('students.unarchived') : t('students.archived'));
    } catch {
      mutateCache<any[]>('/admin/students', undefined, () => prev);
      toast.error(t('toast.error'));
    }
  }
  async function remove(id: string) {
    const ok = await confirmDialog({
      title: t('students.confirmDelete'),
      body: t('students.confirmDeleteBody'),
      danger: true, okLabel: t('btn.delete'),
    });
    if (!ok) return;
    const prev = list || [];
    mutateCache<any[]>('/admin/students', undefined, (cur) => (cur || []).filter((s) => s.id !== id));
    try {
      await api.delete(`/admin/users/${id}`);
      invalidateApi('/admin/students');
      toast.success(t('students.deleted'));
    } catch {
      mutateCache<any[]>('/admin/students', undefined, () => prev);
      toast.error(t('toast.notDeleted'));
    }
  }

  return (
    <Shell title={t('nav.students')}>
      <div className="fin-toolbar" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍 Поиск по ФИО / логину / email / учителю" style={{ maxWidth: 360 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
          <option value="ALL">Все ({list?.length ?? 0})</option>
          <option value="active">Активные</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      {!list && loading ? <SkeletonTable rows={6} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('students.fullName')}</th><th>{t('profile.login')}</th><th>{t('nav.teachers')}</th><th>{t('calendar.status')}</th><th></th></tr></thead>
            <tbody>
              {visible.map((s) => {
                const tags = (s.tags || '').split(',').filter(Boolean);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/admin/students/${s.id}`} style={{ fontWeight: 500 }}>{s.fullName}</Link>
                      {tags.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {tags.map((t: string) => <span key={t} className="status-badge status-primary" style={{ fontSize: 9, padding: '1px 6px' }}>#{t}</span>)}
                        </div>
                      )}
                    </td>
                    <td>{s.login}</td>
                    <td>
                      {s.studentProfile?.teacher
                        ? <Link to={`/admin/teachers/${s.studentProfile.teacher.id}`}>{s.studentProfile.teacher.fullName}</Link>
                        : '—'}
                    </td>
                    <td>{s.archived ? <StatusBadge status="ARCHIVED" /> : <StatusBadge status="ACTIVE" label={t('students.active')} />}</td>
                    <td className="admin-row-actions">
                      <Link className="btn btn-sm" to={`/admin/students/${s.id}`}>{t('btn.open')}</Link>
                      <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id, s.archived)}>{s.archived ? t('btn.unarchive') : t('btn.archive')}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>{t('btn.delete')}</button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={5} className="empty">{search || filter !== 'ALL' ? t('empty.noFound') : t('empty.noStudents')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
