import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { Kpi, MiniBars } from '../../components/AdminUI';
import { useT } from '../../i18n';

export function AdminAnalytics() {
  const { t } = useT();
  const [period, setPeriod] = useState('30d');
  const { data, loading } = useApi<any>(`/admin/analytics?period=${period}`);

  if (!data && loading) return <Shell title={t('nav.analytics')}><SkeletonGrid count={6} /></Shell>;
  if (!data) return null;

  const b = data.business;
  const p = data.product;
  const o = data.ops;

  return (
    <Shell title={t('nav.analytics')}>
      <div className="admin-toolbar">
        <span className="muted" style={{ fontSize: 13 }}>{t('admin.analytics.period')}</span>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="7d">7 дн.</option>
          <option value="30d">30 дн.</option>
          <option value="90d">90 дн.</option>
          <option value="all">{t('admin.analytics.allTime')}</option>
        </select>
      </div>

      <h3 className="admin-section-title">{t('admin.analytics.business')}</h3>
      <div className="kpi-grid">
        <Kpi label={t('admin.analytics.teachersTotal')} value={b.teachersTotal} />
        <Kpi label={t('admin.analytics.teachersActive')} value={b.teachersActive} accent="success" />
        <Kpi label={t('admin.analytics.subsActive')} value={b.subsActive} accent="success" />
        <Kpi label={t('admin.analytics.subsTrial')} value={b.subsTrial} accent="warning" />
        <Kpi label={t('admin.analytics.subsExpired')} value={b.subsExpired} accent="danger" />
        <Kpi label={t('admin.analytics.studentsTotal')} value={b.studentsTotal} />
        <Kpi label={t('admin.analytics.studentsActive')} value={b.studentsActive} accent="success" />
        <Kpi label={t('admin.analytics.coursesTotal')} value={b.coursesTotal} />
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('admin.analytics.teacherSeries')}</h3>
          <MiniBars data={b.teacherSeries || []} height={80} color="var(--primary)" />
        </div>
        <div className="card">
          <h3>{t('admin.analytics.revenueSeries')}</h3>
          <MiniBars data={b.revenueSeries || []} height={80} color="#f59e0b" />
        </div>
      </div>

      <h3 className="admin-section-title">{t('admin.analytics.product')}</h3>
      <div className="kpi-grid">
        <Kpi label={t('admin.analytics.lessonsCompleted')} value={p.lessonsCompleted} accent="success" />
        <Kpi label={t('admin.analytics.lessonsTotal')} value={p.lessonsTotal} />
        <Kpi label={t('admin.analytics.completionRate')} value={`${Math.round(p.completionRate * 100)}%`} accent="primary" />
        <Kpi label={t('admin.analytics.homeworkDone')} value={p.homeworkDone} accent="success" />
        <Kpi label={t('admin.analytics.homeworkTotal')} value={p.homeworkTotal} />
      </div>

      <h3 className="admin-section-title">{t('admin.analytics.ops')}</h3>
      <div className="card">
        <h3>{t('admin.analytics.actionsByType')}</h3>
        {(o.auditStats || []).length === 0
          ? <div className="empty">{t('admin.empty.noActions')}</div>
          : (
            <table className="table">
              <thead><tr><th>{t('admin.analytics.action')}</th><th>{t('admin.analytics.count')}</th></tr></thead>
              <tbody>
                {(o.auditStats || []).map((row: any) => (
                  <tr key={row.action}>
                    <td><span className="audit-action">{row.action}</span></td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </Shell>
  );
}
