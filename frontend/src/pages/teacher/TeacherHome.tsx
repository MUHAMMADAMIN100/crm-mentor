import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { TreeView } from '../../components/Tree';
import { SkeletonCard, SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';

export function TeacherHome() {
  const { data, loading } = useApi<any>('/teacher/dashboard');

  if (!data && loading) {
    return (
      <Shell title="Главное">
        <SkeletonGrid count={3} />
        <div style={{ marginTop: 16 }}><SkeletonCard lines={5} /></div>
      </Shell>
    );
  }

  return (
    <Shell title="Главное">
      <div className="cards-grid">
        <div className="card">
          <h3>Расписание на сегодня</h3>
          {data?.todayLessons?.length ? data.todayLessons.map((l: any) => (
            <div key={l.id} className="list-item">
              <div>
                <div style={{ fontWeight: 500 }}>{new Date(l.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.type === 'INDIVIDUAL' ? 'Индивидуальный' : 'Групповой'} · {l.durationMin} мин</div>
              </div>
              <div className={`badge badge-${badgeForStatus(l.status)}`}>{statusLabel(l.status)}</div>
            </div>
          )) : <div className="empty">На сегодня уроков нет</div>}
        </div>

        <div className="card">
          <h3>Сводка</h3>
          <div className="list">
            <div className="list-item"><span className="muted">Учеников</span><strong>{data?.students?.length ?? 0}</strong></div>
            <div className="list-item"><span className="muted">Уроков на сегодня</span><strong>{data?.todayLessons?.length ?? 0}</strong></div>
            <div className="list-item"><span className="muted">Уведомлений</span><strong>{(data?.notifications || []).length}</strong></div>
          </div>
        </div>

        <NotesCard />

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>Уведомления</h3>
          <div className="list">
            {(data?.notifications || []).slice(0, 8).map((n: any) => (
              <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                <div style={{ fontWeight: 500 }}>{n.title}</div>
                {n.body && <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>}
                <div className="meta">{new Date(n.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
            {(!data?.notifications || data.notifications.length === 0) && <div className="empty">Уведомлений нет</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Сад учеников</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {(data?.students || []).map((s: any) => (
            <TreeView key={s.id} name={s.user.fullName} tree={s.tree} />
          ))}
          {(!data?.students || data.students.length === 0) && <div className="empty" style={{ gridColumn: '1 / -1' }}>Нет учеников</div>}
        </div>
      </div>
    </Shell>
  );
}

function badgeForStatus(s: string) {
  if (s === 'COMPLETED') return 'success';
  if (s === 'CANCELLED') return 'past';
  return 'neutral';
}
function statusLabel(s: string) {
  return ({ PLANNED: 'запланирован', COMPLETED: 'проведён', CANCELLED: 'отменён', RESCHEDULED: 'перенесён' } as any)[s] || s;
}
