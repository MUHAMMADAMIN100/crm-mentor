import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { TreeView } from '../../components/Tree';
import { SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';
import { useT } from '../../i18n';

export function StudentHome() {
  const { t } = useT();
  const { data, loading: loadingDash } = useApi<any>('/students/me/dashboard');
  const { data: progress } = useApi<any>('/progress/me');
  const [showProgress, setShowProgress] = useState(false);

  if (!data && !progress && loadingDash) {
    return (
      <Shell title={t('nav.home')}>
        <SkeletonGrid count={4} />
      </Shell>
    );
  }

  return (
    <Shell title={t('nav.home')}>
      <div className="cards-grid">
        <div className="card">
          <h3>{t('dash.progress')}</h3>
          {progress ? (
            <>
              <div onClick={() => setShowProgress(!showProgress)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{progress.lessons[0]}</span>
                  <span className="muted">/ {progress.lessons[1]} {t('dash.lessonsCnt')}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{t('dash.detailsClick')}</div>
              </div>
              {showProgress && (
                <div className="list" style={{ marginTop: 12 }}>
                  {Object.entries(progress.byType).map(([k, v]: any) => (
                    <div key={k} className="list-item">
                      <span>{t(`dash.byType.${k}` as any) || k}</span>
                      <span><strong>{v[0]}</strong> / {v[1]}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : '—'}
        </div>

        <div className="card">
          <h3>{t('dash.tree')}</h3>
          <TreeView tree={data?.profile?.tree} />
        </div>

        <div className="card">
          <h3>{t('students.upcoming')}</h3>
          <div className="list">
            {(data?.upcomingLessons || []).map((l: any) => (
              <div key={l.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{new Date(l.startAt).toLocaleString()}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{l.type === 'INDIVIDUAL' ? t('misc.individualLessonShort') : t('misc.groupLessonShort')}</div>
                </div>
                {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">{t('dash.entered')}</a>}
              </div>
            ))}
            {(!data?.upcomingLessons || data.upcomingLessons.length === 0) && <div className="empty">{t('empty.noLessons')}</div>}
          </div>
        </div>

        <div className="card">
          <h3>{t('hw.upcoming')}</h3>
          <div className="list">
            {(data?.homeworks || []).map((h: any) => (
              <div key={h.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{h.courseLesson?.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {h.courseLesson?.deadlineAt && `${t('course.untilDate')} ${new Date(h.courseLesson.deadlineAt).toLocaleString()}`}
                  </div>
                </div>
                <span className={`badge badge-${badgeStatus(h.status)}`}>{t(`hw.${h.status}` as any) || h.status}</span>
              </div>
            ))}
            {(!data?.homeworks || data.homeworks.length === 0) && <div className="empty">{t('empty.noHomework')}</div>}
          </div>
        </div>

        <NotesCard />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('home.notifications')}</h3>
        <div className="list">
          {(data?.notifications || []).slice(0, 8).map((n: any) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <div style={{ fontWeight: 500 }}>{n.title}</div>
              {n.body && <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>}
              <div className="meta">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {(!data?.notifications || data.notifications.length === 0) && <div className="empty">{t('empty.noNotifications')}</div>}
        </div>
      </div>
    </Shell>
  );
}

function badgeStatus(s: string) {
  if (s === 'COMPLETED') return 'success';
  if (s === 'OVERDUE') return 'danger';
  return 'warning';
}
