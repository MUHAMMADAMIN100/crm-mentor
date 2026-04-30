import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { useT } from '../../i18n';

export function AdminCourses() {
  const { t } = useT();
  const { data: list, loading } = useApi<any[]>('/admin/courses');
  return (
    <Shell title={t('nav.courses')}>
      {!list && loading ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('course.title2')}</th><th>{t('nav.teachers')}</th><th>{t('course.status')}</th><th>{t('course.modules')}</th><th>{t('course.studentsCount')}</th></tr></thead>
            <tbody>
              {(list || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td><td>{c.teacher?.fullName}</td>
                  <td><span className="badge badge-neutral">{c.status}</span></td>
                  <td>{c._count?.modules}</td><td>{c._count?.accesses}</td>
                </tr>
              ))}
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">{t('empty.noCourses')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
