import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';
import { useT } from '../../i18n';

export function AdminHome() {
  const { t } = useT();
  const { data: stats, loading } = useApi<any>('/admin/analytics');
  return (
    <Shell title={t('nav.home')}>
      {!stats && loading ? <SkeletonGrid count={5} /> : (
        <>
          <div className="cards-grid">
            <Stat label={t('nav.teachers')} value={stats?.teachers ?? '—'} />
            <Stat label={t('nav.students')} value={stats?.students ?? '—'} />
            <Stat label={t('nav.courses')} value={stats?.courses ?? '—'} />
            <Stat label={`${t('lesson.COMPLETED')}`} value={stats?.lessonsCompleted ?? '—'} />
            <Stat label={`${t('hw.COMPLETED')}`} value={stats?.homeworkDone ?? '—'} />
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
