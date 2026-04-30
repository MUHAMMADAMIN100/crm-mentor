import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';

export function AdminCourses() {
  const { data: list, loading } = useApi<any[]>('/admin/courses');
  return (
    <Shell title="Курсы">
      {!list && loading ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Название</th><th>Учитель</th><th>Статус</th><th>Модули</th><th>Учеников</th></tr></thead>
            <tbody>
              {(list || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td><td>{c.teacher?.fullName}</td>
                  <td><span className="badge badge-neutral">{c.status}</span></td>
                  <td>{c._count?.modules}</td><td>{c._count?.accesses}</td>
                </tr>
              ))}
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">Нет курсов</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
