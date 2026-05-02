import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Loading } from '../../components/Loading';
import { useApi } from '../../hooks';
import { api, invalidateApi } from '../../api';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { Kpi, StatusBadge } from '../../components/AdminUI';

export function AdminCourseCard() {
  const { t } = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const { data, refetch } = useApi<any>(`/admin/courses/${id}`);
  const { data: progress } = useApi<any>(id ? `/admin/courses/${id}/progress` : '');
  const { data: settings } = useApi<any>('/admin/system/settings');
  let formats: string[] = ['online', 'offline', 'hybrid', 'mixed'];
  try { if (settings && typeof settings['ref.courseFormats'] === 'string') formats = JSON.parse(settings['ref.courseFormats']); } catch {}
  const [formatEdit, setFormatEdit] = useState<string | null>(null);

  if (!data) return <Shell title={t('admin.course.cardTitle')}><Loading label={t('loader.course')} /></Shell>;
  const c = data;

  function saveFormat(value: string) {
    setFormatEdit(null);
    api.patch(`/admin/courses/${c.id}/format`, { format: value })
      .then(() => { invalidateApi('/admin/courses'); refetch(); toast.success(t('admin.system.saved')); })
      .catch(() => toast.error(t('toast.error')));
  }

  async function setStatus(status: string) {
    if (status === 'ARCHIVED') {
      const ok = await confirmDialog({ title: t('admin.course.confirmArchive'), danger: true, okLabel: t('btn.archive') });
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/courses/${c.id}/status`, { status });
      invalidateApi('/admin/courses');
      refetch();
      toast.success(t('admin.system.saved'));
    } catch { toast.error(t('toast.error')); }
  }
  async function toggleHidden() {
    try {
      await api.patch(`/admin/courses/${c.id}/hidden`);
      invalidateApi('/admin/courses');
      refetch();
      toast.success(t('admin.system.saved'));
    } catch { toast.error(t('toast.error')); }
  }
  async function duplicate() {
    try {
      const r = await api.post(`/admin/courses/${c.id}/duplicate`);
      invalidateApi('/admin/courses');
      toast.success(t('admin.course.duplicated'));
      nav(`/admin/courses/${r.data.id}`);
    } catch { toast.error(t('toast.error')); }
  }

  const totalLessons = (c.modules || []).reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
  const totalBlocks = (c.modules || []).reduce(
    (s: number, m: any) => s + (m.lessons || []).reduce((s2: number, l: any) => s2 + (l.blocks?.length || 0), 0),
    0,
  );

  return (
    <Shell title={c.title}>
      <div className="flex" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link to="/admin/courses" className="btn btn-sm">← {t('btn.back')}</Link>
        <div className="spacer" />
        <StatusBadge status={c.status} />
        {c.hidden && <span className="status-badge status-muted">{t('admin.course.hidden')}</span>}
        <button className="btn btn-sm" onClick={duplicate}>{t('admin.course.duplicate')}</button>
        <button className="btn btn-sm" onClick={toggleHidden}>{c.hidden ? t('admin.course.show') : t('admin.course.hide')}</button>
        {c.status !== 'PUBLISHED_PRIVATE' && <button className="btn btn-sm" onClick={() => setStatus('PUBLISHED_PRIVATE')}>{t('admin.course.publish')}</button>}
        {c.status !== 'DRAFT' && <button className="btn btn-sm" onClick={() => setStatus('DRAFT')}>{t('admin.course.toDraft')}</button>}
        {c.status !== 'ARCHIVED' && <button className="btn btn-sm btn-danger" onClick={() => setStatus('ARCHIVED')}>{t('btn.archive')}</button>}
      </div>

      <div className="kpi-grid">
        <Kpi label={t('admin.course.modules')} value={(c.modules || []).length} />
        <Kpi label={t('admin.course.lessons')} value={totalLessons} />
        <Kpi label={t('admin.course.blocks')} value={totalBlocks} />
        <Kpi label={t('admin.course.accesses')} value={(c.accesses || []).length} accent="success" />
        <Kpi label={t('admin.course.avgProgress')} value={progress ? `${progress.avgPercent || 0}%` : '—'} accent="primary" hint={t('admin.course.avgProgressHint')} />
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('admin.course.info')}</h3>
          <ProfRow label={t('admin.course.teacher')} value={c.teacher ? <Link to={`/admin/teachers/${c.teacher.id}`}>{c.teacher.fullName}</Link> : '—'} />
          <ProfRow label={t('admin.course.status')} value={<StatusBadge status={c.status} />} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontSize: 12 }}>{t('admin.course.format')}</span>
            <span style={{ textAlign: 'right' }}>
              {formatEdit !== null ? (
                <select className="select" autoFocus
                  value={formatEdit} onChange={(e) => setFormatEdit(e.target.value)}
                  onBlur={() => saveFormat(formatEdit)}
                  style={{ minWidth: 140 }}>
                  <option value="">—</option>
                  {formats.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <button onClick={() => setFormatEdit(c.format || '')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline dotted', color: 'inherit', padding: 0 }}>
                  {c.format || '—'}
                </button>
              )}
            </span>
          </div>
          <ProfRow label={t('admin.teacher.createdAt')} value={new Date(c.createdAt).toLocaleDateString()} />
          {c.category && <ProfRow label={t('profile.category')} value={c.category} />}
        </div>

        <div className="card">
          <h3>{t('admin.course.studentsList')} ({(c.accesses || []).length})</h3>
          <div className="list" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {(c.accesses || []).map((a: any) => (
              <Link key={a.id} to={`/admin/students/${a.student.user.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.student.user.fullName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{a.student.user.login}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : '—'}</div>
              </Link>
            ))}
            {(c.accesses || []).length === 0 && <div className="empty">—</div>}
          </div>
        </div>

        {progress && progress.students && progress.students.length > 0 && (
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <h3>{t('admin.course.studentProgress')} · {t('admin.course.avgProgress')}: {progress.avgPercent || 0}%</h3>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>{t('profile.fullName')}</th><th>{t('admin.course.progress')}</th><th>{t('admin.course.completed')}</th></tr></thead>
                <tbody>
                  {progress.students.map((s: any) => (
                    <tr key={s.studentId}>
                      <td>
                        <Link to={`/admin/students/${s.studentId}`}>{s.fullName}</Link>
                        <div className="muted" style={{ fontSize: 11 }}>{s.login}</div>
                      </td>
                      <td>
                        <div style={{ width: '100%', minWidth: 140, background: 'var(--surface-2)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${s.percent}%`, height: '100%', background: s.percent >= 80 ? 'var(--success)' : s.percent >= 30 ? 'var(--primary)' : '#b45309' }} />
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.percent}%</div>
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.done} / {s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>{t('admin.course.structure')}</h3>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {(c.modules || []).map((m: any) => (
              <div key={m.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                <div style={{ fontWeight: 600 }}>{m.title}</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  {(m.lessons || []).length} {t('admin.course.lessonsLabel')}
                </div>
                {(m.lessons || []).map((l: any) => (
                  <div key={l.id} style={{ paddingLeft: 14, paddingTop: 4 }}>
                    <span style={{ fontWeight: 500 }}>{l.title}</span>
                    {l.isHomework && <StatusBadge status="warning" label={t('course.dz')} />}
                    <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{(l.blocks || []).length} {t('admin.course.blocksLabel')}</span>
                  </div>
                ))}
              </div>
            ))}
            {(c.modules || []).length === 0 && <div className="empty">—</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ProfRow({ label, value }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}
