import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';

export function AdminStudents() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/students').then((r) => setList(r.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function archive(id: string, archived: boolean) {
    try {
      if (archived) await api.patch(`/admin/users/${id}/unarchive`);
      else await api.patch(`/admin/users/${id}/archive`);
      toast.success(archived ? 'Восстановлен' : 'Архивирован');
      load();
    } catch { toast.error('Не удалось'); }
  }
  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Удалить ученика?',
      body: 'Аккаунт и все связанные данные будут удалены навсегда.',
      danger: true, okLabel: 'Удалить',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('Удалён');
      load();
    } catch { toast.error('Не удалось удалить'); }
  }

  return (
    <Shell title="Ученики">
      {loading && list.length === 0 ? <SkeletonTable rows={6} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ФИО</th><th>Логин</th><th>Учитель</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
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
              {list.length === 0 && <tr><td colSpan={5} className="empty">Нет учеников</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
