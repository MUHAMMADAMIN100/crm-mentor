import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';

export function StudentCourses() {
  const { data: list, loading } = useApi<any[]>('/courses/me/list');
  return (
    <Shell title="Курсы">
      {loading && !list ? <SkeletonGrid count={3} /> : (
        <div className="cards-grid">
          {(list || []).map((a) => {
            const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
            return (
              <Link key={a.id} to={`/student/courses/${a.course.id}`} className="card" style={{ display: 'block' }}>
                <h3>{a.course.title}</h3>
                <p className="muted">{a.course.teacher?.fullName}</p>
                <p>{a.course.modules.length} модулей</p>
                {a.expiresAt && (
                  <span className={`badge ${expired ? 'badge-danger' : 'badge-warning'}`}>
                    {expired ? 'доступ истёк' : `до ${new Date(a.expiresAt).toLocaleDateString('ru-RU')}`}
                  </span>
                )}
              </Link>
            );
          })}
          {(!list || list.length === 0) && <div className="empty">Нет курсов</div>}
        </div>
      )}
    </Shell>
  );
}
