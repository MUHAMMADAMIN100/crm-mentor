import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';

export function AdminHome() {
  const { data: stats, loading } = useApi<any>('/admin/analytics');
  return (
    <Shell title="Главное">
      {!stats && loading ? <SkeletonGrid count={5} /> : (
        <>
          <div className="cards-grid">
            <Stat label="Учителей" value={stats?.teachers ?? '—'} />
            <Stat label="Учеников" value={stats?.students ?? '—'} />
            <Stat label="Курсов" value={stats?.courses ?? '—'} />
            <Stat label="Уроков проведено" value={stats?.lessonsCompleted ?? '—'} />
            <Stat label="ДЗ выполнено" value={stats?.homeworkDone ?? '—'} />
          </div>
          <div style={{ marginTop: 16 }}>
            <NotesCard minHeight={140} />
          </div>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>{value}</div>
    </div>
  );
}
