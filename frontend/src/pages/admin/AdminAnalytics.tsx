import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { Kpi, MiniBars } from '../../components/AdminUI';
import { useT } from '../../i18n';

const PRESETS: { code: string; labelKey: string }[] = [
  { code: 'today', labelKey: 'admin.analytics.today' },
  { code: '7d', labelKey: 'admin.analytics.7d' },
  { code: '30d', labelKey: 'admin.analytics.30d' },
  { code: 'quarter', labelKey: 'admin.analytics.quarter' },
  { code: '90d', labelKey: 'admin.analytics.90d' },
  { code: 'all', labelKey: 'admin.analytics.allTime' },
  { code: 'custom', labelKey: 'admin.analytics.custom' },
];

export function AdminAnalytics() {
  const { t } = useT();
  const [period, setPeriod] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const url = period === 'custom' && from && to
    ? `/admin/analytics?from=${from}&to=${to}`
    : `/admin/analytics?period=${period}`;
  const { data, loading } = useApi<any>(url);

  if (!data && loading) return <Shell title={t('nav.analytics')}><SkeletonGrid count={6} /></Shell>;
  if (!data) return null;

  const b = data.business;
  const p = data.product;
  const o = data.ops;

  return (
    <Shell title={t('nav.analytics')}>
      <div className="admin-toolbar">
        <span className="muted" style={{ fontSize: 13 }}>{t('admin.analytics.period')}</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.code}
            className={`btn btn-sm ${period === preset.code ? 'btn-primary' : ''}`}
            onClick={() => setPeriod(preset.code)}
          >
            {t(preset.labelKey as any)}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" className="input" style={{ maxWidth: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>→</span>
            <input type="date" className="input" style={{ maxWidth: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
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
        <Kpi label={t('admin.analytics.trialConversion')} value={`${Math.round((b.trialConversion || 0) * 100)}%`} accent="primary" hint={t('admin.analytics.trialConversionHint')} />
        <Kpi label={t('admin.analytics.avgCheck')} value={`${Math.round(b.avgCheck || 0).toLocaleString()} ₽`} accent="primary" hint={t('admin.analytics.avgCheckHint')} />
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('admin.analytics.teacherSeries')}</h3>
          <MiniBars data={b.teacherSeries || []} height={80} color="var(--primary)" />
        </div>
        <div className="card">
          <h3>{t('admin.analytics.studentSeries')}</h3>
          <MiniBars data={b.studentSeries || []} height={80} color="var(--success)" />
        </div>
        <div className="card">
          <h3>{t('admin.analytics.revenueSeries')}</h3>
          <MiniBars data={b.revenueSeries || []} height={80} color="#f59e0b" />
        </div>
      </div>

      <h3 className="admin-section-title">{t('admin.analytics.product')}</h3>
      <div className="kpi-grid">
        <Kpi label={t('admin.analytics.dau')} value={p.dau} accent="primary" hint={t('admin.analytics.dauHint')} />
        <Kpi label={t('admin.analytics.wau')} value={p.wau} accent="primary" hint={t('admin.analytics.wauHint')} />
        <Kpi label={t('admin.analytics.mau')} value={p.mau} accent="primary" hint={t('admin.analytics.mauHint')} />
        <Kpi label={t('admin.analytics.stickiness')} value={`${Math.round((p.stickiness || 0) * 100)}%`} accent="success" hint={t('admin.analytics.stickinessHint')} />
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
