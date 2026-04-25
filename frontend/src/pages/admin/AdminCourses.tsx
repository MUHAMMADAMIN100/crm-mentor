import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function AdminCourses() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api.get('/admin/courses').then((r) => setList(r.data)); }, []);
  return (
    <Shell title="Курсы">
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Название</th><th>Учитель</th><th>Статус</th><th>Модули</th><th>Учеников</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td><td>{c.teacher?.fullName}</td>
                <td><span className="badge badge-neutral">{c.status}</span></td>
                <td>{c._count?.modules}</td><td>{c._count?.accesses}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="empty">Нет курсов</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
