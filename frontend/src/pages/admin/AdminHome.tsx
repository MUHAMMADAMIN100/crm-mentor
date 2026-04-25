import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function AdminHome() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { api.get('/admin/analytics').then((r) => setStats(r.data)); }, []);
  return (
    <Shell title="Главное">
      <div className="cards-grid">
        <Stat label="Учителей" value={stats?.teachers ?? '—'} />
        <Stat label="Учеников" value={stats?.students ?? '—'} />
        <Stat label="Курсов" value={stats?.courses ?? '—'} />
        <Stat label="Уроков проведено" value={stats?.lessonsCompleted ?? '—'} />
        <Stat label="ДЗ выполнено" value={stats?.homeworkDone ?? '—'} />
      </div>
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
