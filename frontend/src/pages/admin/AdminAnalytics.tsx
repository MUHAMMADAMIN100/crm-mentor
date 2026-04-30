import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { useT } from '../../i18n';

export function AdminAnalytics() {
  const { t } = useT();
  const { data: stats, loading } = useApi<any>('/admin/analytics');
  function labelOf(k: string) {
    const map: Record<string, string> = {
      teachers: t('nav.teachers'),
      students: t('nav.students'),
      courses: t('nav.courses'),
      lessonsCompleted: t('lesson.COMPLETED'),
      homeworkDone: t('hw.COMPLETED'),
    };
    return map[k] || k;
  }
  return (
    <Shell title={t('nav.analytics')}>
      {!stats && loading ? <SkeletonGrid count={5} /> : (
        <div className="cards-grid">
          {Object.entries(stats || {}).map(([k, v]) => (
            <div key={k} className="card">
              <div className="muted" style={{ fontSize: 13 }}>{labelOf(k)}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>{String(v)}</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
