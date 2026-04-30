import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { TreeView } from '../../components/Tree';
import { SkeletonCard, SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';
import { NotificationDetailsModal } from '../../components/NotificationDetailsModal';
import { useT } from '../../i18n';

export function TeacherHome() {
  const { t } = useT();
  const { data, loading } = useApi<any>('/teacher/dashboard');
  const [pickedNotif, setPickedNotif] = useState<any>(null);

  if (!data && loading) {
    return (
      <Shell title={t('nav.home')}>
        <SkeletonGrid count={3} />
        <div style={{ marginTop: 16 }}><SkeletonCard lines={5} /></div>
      </Shell>
    );
  }

  return (
    <Shell title={t('nav.home')}>
      <div className="cards-grid">
        <div className="card">
          <h3>{t('home.todaySchedule')}</h3>
          {data?.todayLessons?.length ? data.todayLessons.map((l: any) => (
            <div key={l.id} className="list-item">
              <div>
                <div style={{ fontWeight: 500 }}>{new Date(l.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.type === 'INDIVIDUAL' ? t('misc.individualLessonShort') : t('misc.groupLessonShort')} · {l.durationMin} {t('misc.duration60')}</div>
              </div>
              <div className={`badge badge-${badgeForStatus(l.status)}`}>{t(`lesson.${l.status}` as any) || l.status}</div>
            </div>
          )) : <div className="empty">{t('empty.noLessonsToday')}</div>}
        </div>

        <div className="card">
          <h3>{t('home.summary')}</h3>
          <div className="list">
            <div className="list-item"><span className="muted">{t('home.studentsLabel')}</span><strong>{data?.students?.length ?? 0}</strong></div>
            <div className="list-item"><span className="muted">{t('home.lessonsToday')}</span><strong>{data?.todayLessons?.length ?? 0}</strong></div>
            <div className="list-item"><span className="muted">{t('home.notificationsLabel')}</span><strong>{(data?.notifications || []).length}</strong></div>
          </div>
        </div>

        <NotesCard />

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>{t('home.notifications')}</h3>
          <div className="list">
            {(data?.notifications || []).slice(0, 8).map((n: any) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                className={`notif-item clickable ${n.read ? '' : 'unread'}`}
                onClick={() => setPickedNotif(n)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickedNotif(n); } }}
              >
                <div style={{ fontWeight: 500 }}>{n.title}</div>
                {n.body && <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>}
                <div className="meta">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {(!data?.notifications || data.notifications.length === 0) && <div className="empty">{t('empty.noNotifications')}</div>}
          </div>
        </div>
      </div>

      {pickedNotif && (
        <NotificationDetailsModal notif={pickedNotif} onClose={() => setPickedNotif(null)} />
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('home.studentsGarden')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {(data?.students || []).map((s: any) => (
            <TreeView key={s.id} name={s.user.fullName} tree={s.tree} />
          ))}
          {(!data?.students || data.students.length === 0) && <div className="empty" style={{ gridColumn: '1 / -1' }}>{t('empty.noStudents')}</div>}
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
