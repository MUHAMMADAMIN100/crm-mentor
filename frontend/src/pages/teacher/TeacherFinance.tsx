import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { useAuth } from '../../store';

export function TeacherFinance() {
  const [data, setData] = useState<any>(null);
  const { user, refreshMe } = useAuth();
  const [currency, setCurrency] = useState((user as any)?.teacherCurrency || 'RUB');

  function load() { api.get('/finance/teacher').then((r) => setData(r.data)); }
  useEffect(load, []);

  async function saveCurrency() {
    await api.patch('/teacher/currency', { currency });
    await refreshMe();
    load();
  }

  return (
    <Shell title="Финансы">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Валюта</h3>
        <div className="row">
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="RUB">₽ Рубль</option>
            <option value="USD">$ Доллар</option>
            <option value="EUR">€ Евро</option>
            <option value="KZT">₸ Тенге</option>
            <option value="UZS">сум Сум</option>
          </select>
          <button className="btn btn-primary" onClick={saveCurrency}>Сохранить</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Применяется ко всем ученикам</p>
      </div>

      {data && (
        <>
          <div className="cards-grid">
            <Stat label="Поступления" value={data.totals.totalIncome} cur={data.currency} />
            <Stat label="Списания" value={data.totals.totalCharged} cur={data.currency} />
            <Stat label="Долги" value={data.totals.totalDebt} cur={data.currency} red />
          </div>
          <div className="card" style={{ marginTop: 16, padding: 0 }}>
            <table className="table">
              <thead><tr><th>Ученик</th><th>Баланс</th><th>Стоимость занятия</th></tr></thead>
              <tbody>
                {data.students.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.fullName}</td>
                    <td style={{ color: s.balance < 0 ? 'var(--danger)' : undefined }}>{s.balance} {data.currency}</td>
                    <td>{s.individualPrice ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value, cur, red }: any) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: red ? 'var(--danger)' : 'var(--primary)', marginTop: 6 }}>
        {value?.toLocaleString('ru-RU')} {cur}
      </div>
    </div>
  );
}
