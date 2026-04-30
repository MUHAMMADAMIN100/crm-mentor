import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

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
              {visible.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.login}</td>
                  <td>{s.studentProfile?.teacher?.fullName || '—'}</td>
                  <td>{s.archived ? <span className="badge badge-past">{t('students.archive')}</span> : <span className="badge badge-success">{t('students.active')}</span>}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id, s.archived)}>{s.archived ? t('btn.unarchive') : t('btn.archive')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>{t('btn.delete')}</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={5} className="empty">{search || filter !== 'ALL' ? t('empty.noFound') : t('empty.noStudents')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
