import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function AdminAnalytics() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { api.get('/admin/analytics').then((r) => setStats(r.data)); }, []);
  return (
    <Shell title="Аналитика">
      <div className="cards-grid">
        {stats && Object.entries(stats).map(([k, v]) => (
          <div key={k} className="card">
            <div className="muted" style={{ fontSize: 13 }}>{labelOf(k)}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>{String(v)}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const LABELS: Record<string, string> = {
  teachers: 'Учителей', students: 'Учеников', courses: 'Курсов',
  lessonsCompleted: 'Проведено уроков', homeworkDone: 'Выполнено ДЗ',
};
function labelOf(k: string) { return LABELS[k] || k; }
