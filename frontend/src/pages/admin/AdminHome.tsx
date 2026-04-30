import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { SkeletonGrid } from '../../components/Skeleton';
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

  return (
    <Shell title={t('nav.home')}>
      {/* KPI grid */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Платформа
      </h3>
      <div className="kpi-grid">
        <Kpi label="Всего учителей" value={c.teachersTotal} sub={`+${c.newTeachers7d} за 7 дн`} />
        <Kpi label="Активные подписки" value={c.teachersActive} accent="success" />
        <Kpi label="На trial" value={c.teachersTrial} accent="warning" />
        <Kpi label="Архив" value={c.teachersArchived} accent="muted" />
        <Kpi label="Всего учеников" value={c.studentsTotal} sub={`+${c.newStudents7d} за 7 дн`} />
        <Kpi label="Активные ученики" value={c.studentsActive} accent="success" />
        <Kpi label="Курсов" value={c.coursesTotal} />
        <Kpi label="Уроков сегодня" value={c.lessonsToday} accent="primary" />
        <Kpi label="Уроков проведено" value={c.lessonsCompletedTotal} />
        <Kpi label="Выручка за месяц" value={`${(c.revenueThisMonth || 0).toLocaleString()} ₽`} accent="primary" />
        <Kpi label="Новые учителя 30д" value={c.newTeachers30d} />
        <Kpi label="Новые ученики 30д" value={c.newStudents30d} />
      </div>

      {/* Needs attention */}
      <h3 style={{ margin: '24px 0 12px', fontSize: 13, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Требует внимания
      </h3>
      <div className="cards-grid">
        <AttentionCard
          title="Подписки заканчиваются (7 дней)"
          color="warning"
          items={a.subsExpiringSoon.map((s: any) => ({
            id: s.id,
            primary: s.teacher?.fullName || s.teacherId,
            secondary: s.endDate ? `до ${new Date(s.endDate).toLocaleDateString()}` : '',
          }))}
          emptyText="Нет подписок, заканчивающихся в ближайшие 7 дней"
        />
        <AttentionCard
          title="Просроченные подписки"
          color="danger"
          items={a.subsExpired.map((s: any) => ({
            id: s.id,
            primary: s.teacher?.fullName || s.teacherId,
            secondary: s.endDate ? new Date(s.endDate).toLocaleDateString() : '',
          }))}
          emptyText="Нет просроченных подписок"
        />
        <AttentionCard
          title="Учителя без учеников"
          color="muted"
          items={a.teachersNoStudents.map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
          }))}
          emptyText="У всех учителей есть ученики"
        />
        <AttentionCard
          title="Учителя без курсов"
          color="muted"
          items={a.teachersNoCourses.map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
          }))}
          emptyText="У всех учителей есть курсы"
        />
        <AttentionCard
          title="Неактивны 7 дней"
          color="warning"
          items={a.inactiveTeachers.map((u: any) => ({
            id: u.id,
            primary: u.fullName,
            secondary: u.login,
          }))}
          emptyText="Все учителя активны"
        />
      </div>

      {/* Recent activity */}
      <h3 style={{ margin: '24px 0 12px', fontSize: 13, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Последние события
      </h3>
      <div className="cards-grid">
        <div className="card">
          <h3>Новые учителя</h3>
          <div className="list">
            {r.teachers.map((u: any) => (
              <div key={u.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{u.fullName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{u.login}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
            {r.teachers.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
        <div className="card">
          <h3>Новые ученики</h3>
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
          <h3>Изменения подписок</h3>
          <div className="list">
            {r.subscriptions.map((s: any) => (
              <div key={s.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{s.teacher?.fullName || s.teacherId}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{s.status} · {s.amount ? s.amount.toLocaleString() + ' ₽' : '—'}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(s.updatedAt).toLocaleDateString()}</div>
              </div>
            ))}
            {r.subscriptions.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' }) {
  const color =
    accent === 'success' ? 'var(--success)'
      : accent === 'warning' ? '#b45309'
      : accent === 'danger' ? 'var(--danger)'
      : accent === 'muted' ? 'var(--text-muted)'
      : 'var(--primary)';
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
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
        {items.map((it: any) => (
          <div key={it.id} className="list-item">
            <div style={{ fontWeight: 500 }}>{it.primary}</div>
            <div className="muted" style={{ fontSize: 12 }}>{it.secondary}</div>
          </div>
        ))}
        {items.length === 0 && <div className="empty" style={{ padding: '16px 8px', fontSize: 13 }}>{emptyText}</div>}
      </div>
    </div>
  );
}
