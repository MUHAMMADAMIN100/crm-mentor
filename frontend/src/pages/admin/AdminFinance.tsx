import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { Loading } from '../../components/Loading';
import { useT } from '../../i18n';

export function AdminFinance() {
  const { t } = useT();
  const { data, loading } = useApi<any>('/admin/finance');
  return (
    <Shell title={t('finance.title')}>
      {!data && loading ? <Loading label={t('loader.finance')} /> : data && (
        <>
          <div className="cards-grid">
            <div className="card">
              <div className="muted" style={{ fontSize: 13 }}>{t('finance.income')}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>
                {data.totalRevenue.toLocaleString()} ₽
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0, marginTop: 16 }}>
            <table className="table">
              <thead><tr><th>{t('nav.teachers')}</th><th>{t('teachers.subscription')}</th><th>{t('calendar.type')}</th><th>{t('teachers.amount')}</th><th>{t('teachers.end')}</th></tr></thead>
              <tbody>
                {data.subscriptions?.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.teacherId}</td>
                    <td><span className="badge badge-neutral">{s.status}</span></td>
                    <td>{s.type || '—'}</td>
                    <td>{s.amount?.toLocaleString()} ₽</td>
                    <td>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
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
