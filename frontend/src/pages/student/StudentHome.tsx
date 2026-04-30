import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { TreeView } from '../../components/Tree';
import { SkeletonGrid } from '../../components/Skeleton';
import { NotesCard } from '../../components/NotesCard';

export function StudentHome() {
  const { data, loading: loadingDash } = useApi<any>('/students/me/dashboard');
  const { data: progress } = useApi<any>('/progress/me');
  const [showProgress, setShowProgress] = useState(false);

  if (!data && !progress && loadingDash) {
    return (
      <Shell title="Главное">
        <SkeletonGrid count={4} />
      </Shell>
    );
  }

  return (
    <Shell title="Главное">
      <div className="cards-grid">
        <div className="card">
          <h3>Прогресс по курсам</h3>
          {progress ? (
            <>
              <div onClick={() => setShowProgress(!showProgress)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{progress.lessons[0]}</span>
                  <span className="muted">/ {progress.lessons[1]} уроков</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>Нажмите для деталей</div>
              </div>
              {showProgress && (
                <div className="list" style={{ marginTop: 12 }}>
                  {Object.entries(progress.byType).map(([k, v]: any) => (
                    <div key={k} className="list-item">
                      <span>{labelType(k)}</span>
                      <span><strong>{v[0]}</strong> / {v[1]}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : '—'}
        </div>

        <div className="card">
          <h3>Дерево мотивации</h3>
          <TreeView tree={data?.profile?.tree} />
        </div>

        <div className="card">
          <h3>Ближайшие занятия</h3>
          <div className="list">
            {(data?.upcomingLessons || []).map((l: any) => (
              <div key={l.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{new Date(l.startAt).toLocaleString('ru-RU')}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{l.type === 'INDIVIDUAL' ? 'Индивидуальный' : 'Групповой'}</div>
                </div>
                {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">Войти</a>}
              </div>
            ))}
            {(!data?.upcomingLessons || data.upcomingLessons.length === 0) && <div className="empty">Нет занятий</div>}
          </div>
        </div>

        <div className="card">
          <h3>Актуальные домашки</h3>
          <div className="list">
            {(data?.homeworks || []).map((h: any) => (
              <div key={h.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{h.courseLesson?.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {h.courseLesson?.deadlineAt && `до ${new Date(h.courseLesson.deadlineAt).toLocaleString('ru-RU')}`}
                  </div>
                </div>
                <span className={`badge badge-${badgeStatus(h.status)}`}>{statusLabel(h.status)}</span>
              </div>
            ))}
            {(!data?.homeworks || data.homeworks.length === 0) && <div className="empty">Нет домашек</div>}
          </div>
        </div>

        <NotesCard />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
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
    </Shell>
  );
}

function labelType(t: string) {
  return ({ VIDEO: 'Видео', TEXT: 'Тексты', FILE: 'Файлы', QUIZ: 'Квизы', WRITTEN: 'Письменные' } as any)[t] || t;
}
function badgeStatus(s: string) {
  if (s === 'COMPLETED') return 'success';
  if (s === 'OVERDUE') return 'danger';
  return 'warning';
}
function statusLabel(s: string) {
  return ({ COMPLETED: 'выполнено', OVERDUE: 'просрочено', IN_PROGRESS: 'в процессе' } as any)[s] || s;
}
