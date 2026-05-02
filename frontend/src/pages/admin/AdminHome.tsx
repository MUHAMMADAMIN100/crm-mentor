import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
import { Kpi, MiniBars } from '../../components/AdminUI';
import { useT } from '../../i18n';

export function AdminHome() {
  const { t } = useT();
  const { data, loading } = useApi<any>('/admin/dashboard');

  if (!data && loading) {
    return (
      <Shell title={t('nav.home')}>
        <SkeletonGrid count={8} />
      </Shell>
    );
  }
  if (!data) return <Shell title={t('nav.home')}><div className="empty">—</div></Shell>;

  const c = data.counts;
  const a = data.attention;
  const r = data.recent;
  const charts = data.charts || {};

  return (
    <Shell title={t('nav.home')}>
      {/* KPI grid */}
      <h3 className="admin-section-title">{t('admin.kpiTitle')}</h3>
      <div className="kpi-grid">
        <Kpi label={t('admin.kpi.teachersTotal')} value={c.teachersTotal} sub={`+${c.newTeachers7d} ${t('admin.kpi.in7d')}`} />
        <Kpi label={t('admin.kpi.teachersActive')} value={c.teachersActive} accent="success" />
        <Kpi label={t('admin.kpi.teachersTrial')} value={c.teachersTrial} accent="warning" />
        <Kpi label={t('admin.kpi.teachersArchived')} value={c.teachersArchived} accent="muted" />
        <Kpi label={t('admin.kpi.studentsTotal')} value={c.studentsTotal} sub={`+${c.newStudents7d} ${t('admin.kpi.in7d')}`} />
        <Kpi label={t('admin.kpi.studentsActive')} value={c.studentsActive} accent="success" />
        <Kpi label={t('admin.kpi.coursesTotal')} value={c.coursesTotal} />
        <Kpi label={t('admin.kpi.lessonsToday')} value={c.lessonsToday} accent="primary" />
        <Kpi label={t('admin.kpi.lessonsCompletedTotal')} value={c.lessonsCompletedTotal} />
        <Kpi label={t('admin.kpi.revenueThisMonth')} value={`${(c.revenueThisMonth || 0).toLocaleString()} ₽`} accent="primary" />
        <Kpi label={t('admin.kpi.newTeachers30d')} value={c.newTeachers30d} />
        <Kpi label={t('admin.kpi.newStudents30d')} value={c.newStudents30d} />
      </div>

      {/* Growth charts */}
      <h3 className="admin-section-title">{t('admin.growthTitle')}</h3>
      <div className="cards-grid">
        <div className="card">
          <div className="flex" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{t('admin.chart.teachers')}</h3>
            <div className="spacer" />
            <span className="muted" style={{ fontSize: 12 }}>{t('admin.chart.last12m')}</span>
          </div>
          <MiniBars data={charts.teachersByMonth || []} height={70} color="var(--primary)" />
        </div>
        <div className="card">
          <div className="flex" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{t('admin.chart.students')}</h3>
            <div className="spacer" />
            <span className="muted" style={{ fontSize: 12 }}>{t('admin.chart.last12m')}</span>
          </div>
          <MiniBars data={charts.studentsByMonth || []} height={70} color="var(--success)" />
        </div>
        <div className="card">
          <div className="flex" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{t('admin.chart.revenue')}</h3>
            <div className="spacer" />
            <span className="muted" style={{ fontSize: 12 }}>{t('admin.chart.last12m')}</span>
          </div>
          <MiniBars data={charts.revenueByMonth || []} height={70} color="#f59e0b" />
        </div>
      </div>

      {/* Needs attention */}
      <h3 className="admin-section-title">{t('admin.attentionTitle')}</h3>
      <div className="cards-grid">
        <AttentionCard
          title={t('admin.attention.subsExpiring')}
          color="warning"
          items={(a.subsExpiringSoon || []).map((s: any) => ({
            id: s.id,
            primary: s.teacher?.fullName || s.teacherId,
            secondary: s.endDate ? `${t('admin.attention.until')} ${new Date(s.endDate).toLocaleDateString()}` : '',
            link: `/admin/teachers/${s.teacher?.id || s.teacherId}`,
          }))}
          emptyText={t('admin.attention.noExpiring')}
        />
        <AttentionCard
          title={t('admin.attention.subsExpired')}
          color="danger"
          items={(a.subsExpired || []).map((s: any) => ({
            id: s.id,
            primary: s.teacher?.fullName || s.teacherId,
            secondary: s.endDate ? new Date(s.endDate).toLocaleDateString() : '',
            link: `/admin/teachers/${s.teacher?.id || s.teacherId}`,
          }))}
          emptyText={t('admin.attention.noExpired')}
        />
        <AttentionCard
          title={t('admin.attention.noStudents')}
          color="muted"
          items={(a.teachersNoStudents || []).map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
            link: `/admin/teachers/${u.id}`,
          }))}
          emptyText={t('admin.attention.allHaveStudents')}
        />
        <AttentionCard
          title={t('admin.attention.noCourses')}
          color="muted"
          items={(a.teachersNoCourses || []).map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
            link: `/admin/teachers/${u.id}`,
          }))}
          emptyText={t('admin.attention.allHaveCourses')}
        />
        <AttentionCard
          title={t('admin.attention.inactive7d')}
          color="warning"
          items={(a.inactiveTeachers || []).map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
            link: `/admin/teachers/${u.id}`,
          }))}
          emptyText={t('admin.attention.allActive')}
        />
      </div>

      {/* Recent activity (audit log + new entities) */}
      <h3 className="admin-section-title">{t('admin.recentTitle')}</h3>
      <div className="cards-grid">
        <div className="card">
          <h3>{t('admin.recent.audit')}</h3>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {(r.audit || []).map((a: any) => (
              <div key={a.id} className="audit-row">
                <span className="audit-action">{a.action}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.actor?.fullName || '—'}</div>
                  {a.targetId && <div className="audit-target">{a.targetType}:{a.targetId.slice(0, 8)}…</div>}
                </div>
                <span className="audit-time">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {(!r.audit || r.audit.length === 0) && <div className="empty">{t('admin.empty.noActions')}</div>}
          </div>
        </div>
        <div className="card">
          <h3>{t('admin.recent.newTeachers')}</h3>
          <div className="list">
            {r.teachers.map((u: any) => (
              <Link key={u.id} to={`/admin/teachers/${u.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{u.fullName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{u.login}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</div>
              </Link>
            ))}
            {r.teachers.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
        <div className="card">
          <h3>{t('admin.recent.newStudents')}</h3>
          <div className="list">
            {r.students.map((u: any) => (
              <div key={u.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{u.fullName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{u.login}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
            {r.students.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
        <div className="card">
          <h3>{t('admin.recent.subscriptions')}</h3>
          <div className="list">
            {r.subscriptions.map((s: any) => (
              <Link key={s.id} to={`/admin/teachers/${s.teacher?.id || s.teacherId}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.teacher?.fullName || s.teacherId}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{s.status} · {s.amount ? s.amount.toLocaleString() + ' ₽' : '—'}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(s.updatedAt).toLocaleDateString()}</div>
              </Link>
            ))}
            {r.subscriptions.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function AttentionCard({ title, items, emptyText, color }: any) {
  const dotColor =
    color === 'danger' ? 'var(--danger)'
      : color === 'warning' ? '#eab308'
      : color === 'muted' ? 'var(--text-muted)'
      : 'var(--primary)';
  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
        {title}
        <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 'auto' }}>{items.length}</span>
      </h3>
      <div className="list" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {items.map((it: any) => (it.link ? (
          <Link key={it.id} to={it.link} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontWeight: 500 }}>{it.primary}</div>
            <div className="muted" style={{ fontSize: 12 }}>{it.secondary}</div>
          </Link>
        ) : (
          <div key={it.id} className="list-item">
            <div style={{ fontWeight: 500 }}>{it.primary}</div>
            <div className="muted" style={{ fontSize: 12 }}>{it.secondary}</div>
          </div>
        )))}
        {items.length === 0 && <div className="empty" style={{ padding: '16px 8px', fontSize: 13 }}>{emptyText}</div>}
      </div>
    </div>
  );
}
