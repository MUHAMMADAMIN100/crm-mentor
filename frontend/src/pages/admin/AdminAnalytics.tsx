import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';

export function AdminAnalytics() {
  const { data: stats, loading } = useApi<any>('/admin/analytics');
  return (
    <Shell title="Аналитика">
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

const LABELS: Record<string, string> = {
  teachers: 'Учителей', students: 'Учеников', courses: 'Курсов',
  lessonsCompleted: 'Проведено уроков', homeworkDone: 'Выполнено ДЗ',
};
function labelOf(k: string) { return LABELS[k] || k; }
