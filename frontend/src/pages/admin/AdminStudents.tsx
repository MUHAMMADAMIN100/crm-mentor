import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function AdminStudents() {
  const [list, setList] = useState<any[]>([]);
  function load() { api.get('/admin/students').then((r) => setList(r.data)); }
  useEffect(load, []);

  async function archive(id: string, archived: boolean) {
    if (archived) await api.patch(`/admin/users/${id}/unarchive`);
    else await api.patch(`/admin/users/${id}/archive`);
    load();
  }
  async function remove(id: string) {
    if (!confirm('Вы уверены? Аккаунт и все данные будут удалены навсегда без возможности восстановления.')) return;
    await api.delete(`/admin/users/${id}`);
    load();
  }

  return (
    <Shell title="Ученики">
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
                <td className="flex" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id, s.archived)}>{s.archived ? 'Восст.' : 'Архив'}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>Удалить</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="empty">Нет учеников</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
