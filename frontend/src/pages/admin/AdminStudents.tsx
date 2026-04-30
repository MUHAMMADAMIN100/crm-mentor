import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';

export function AdminStudents() {
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
      toast.success(archived ? 'Восстановлен' : 'Архивирован');
    } catch {
      mutateCache<any[]>('/admin/students', undefined, () => prev);
      toast.error('Не удалось');
    }
  }
  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Удалить ученика?',
      body: 'Аккаунт и все связанные данные будут удалены навсегда.',
      danger: true, okLabel: 'Удалить',
    });
    if (!ok) return;
    const prev = list || [];
    mutateCache<any[]>('/admin/students', undefined, (cur) => (cur || []).filter((s) => s.id !== id));
    try {
      await api.delete(`/admin/users/${id}`);
      invalidateApi('/admin/students');
      toast.success('Удалён');
    } catch {
      mutateCache<any[]>('/admin/students', undefined, () => prev);
      toast.error('Не удалось удалить');
    }
  }

  return (
    <Shell title="Ученики">
      {!list && loading ? <SkeletonTable rows={6} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ФИО</th><th>Логин</th><th>Учитель</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {(list || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.login}</td>
                  <td>{s.studentProfile?.teacher?.fullName || '—'}</td>
                  <td>{s.archived ? <span className="badge badge-past">архив</span> : <span className="badge badge-success">активен</span>}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id, s.archived)}>{s.archived ? 'Восст.' : 'Архив'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">Нет учеников</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
