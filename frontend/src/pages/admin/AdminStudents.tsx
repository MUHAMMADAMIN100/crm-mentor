import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

export function AdminStudents() {
  const { t } = useT();
  const { data: list, loading } = useApi<any[]>('/admin/students');

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
      {!list && loading ? <SkeletonTable rows={6} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('students.fullName')}</th><th>{t('profile.login')}</th><th>{t('nav.teachers')}</th><th>{t('calendar.status')}</th><th></th></tr></thead>
            <tbody>
              {(list || []).map((s) => (
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
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">{t('empty.noStudents')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
