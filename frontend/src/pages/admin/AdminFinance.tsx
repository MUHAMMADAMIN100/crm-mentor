import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function AdminFinance() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/admin/finance').then((r) => setData(r.data)); }, []);
  return (
    <Shell title="Финансы">
      <div className="cards-grid">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Выручка Miz</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>
            {data ? data.totalRevenue.toLocaleString('ru-RU') + ' ₽' : '—'}
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>Учитель</th><th>Статус</th><th>Тип</th><th>Сумма</th><th>До</th></tr></thead>
          <tbody>
            {data?.subscriptions?.map((s: any) => (
              <tr key={s.id}>
                <td>{s.teacherId}</td>
                <td><span className="badge badge-neutral">{s.status}</span></td>
                <td>{s.type || '—'}</td>
                <td>{s.amount?.toLocaleString('ru-RU')} ₽</td>
                <td>{s.endDate ? new Date(s.endDate).toLocaleDateString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
