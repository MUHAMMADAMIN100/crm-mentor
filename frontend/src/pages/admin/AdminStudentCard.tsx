import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { useApi } from '../../hooks';
import { api, invalidateApi } from '../../api';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { Kpi, StatusBadge } from '../../components/AdminUI';

const TAG_OPTIONS = ['vip', 'new', 'inactive', 'problem', 'champion'];

export function AdminStudentCard() {
  const { t } = useT();
  const { id } = useParams();
  const { data, refetch } = useApi<any>(`/admin/students/${id}`);
  const { data: teachers } = useApi<any[]>('/admin/teachers');
  const [transferOpen, setTransferOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  if (!data) return <Shell title={t('admin.student.cardTitle')}><Loading label={t('loader.profile')} /></Shell>;
  const u = data.user;
  const sp = u.studentProfile;
  const stats = data.stats;
  const tags = (u.tags || '').split(',').filter(Boolean);

  async function archive() {
    const ok = await confirmDialog({ title: t('students.confirmArchive'), body: t('students.confirmArchiveBody'), okLabel: t('btn.archive'), danger: true });
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${u.id}/archive`);
      invalidateApi('/admin/students');
      refetch();
      toast.success(t('students.archived'));
    } catch { toast.error(t('toast.error')); }
  }

  async function unarchive() {
    try {
      await api.patch(`/admin/users/${u.id}/unarchive`);
      refetch();
      toast.success(t('students.unarchived'));
    } catch { toast.error(t('toast.error')); }
  }

  return (
    <Shell title={u.fullName}>
      <div className="flex" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link to="/admin/students" className="btn btn-sm">← {t('btn.back')}</Link>
        <div className="spacer" />
        {u.archived && <StatusBadge status="ARCHIVED" />}
        {tags.map((t) => <span key={t} className="status-badge status-primary">#{t}</span>)}
        <button className="btn btn-sm" onClick={() => setTagsOpen(true)}>{t('admin.student.tags')}</button>
        <button className="btn btn-sm" onClick={() => setTransferOpen(true)}>{t('admin.student.transfer')}</button>
        {u.archived
          ? <button className="btn btn-sm" onClick={unarchive}>{t('btn.unarchive')}</button>
          : <button className="btn btn-sm btn-danger" onClick={archive}>{t('btn.archive')}</button>}
      </div>

      <div className="kpi-grid">
        <Kpi label={t('admin.student.balance')} value={`${(sp?.balance || 0).toLocaleString()} ₽`} accent={sp?.balance < 0 ? 'danger' : 'primary'} />
        <Kpi label={t('admin.student.lessonsCount')} value={stats.lessonsCount} />
        <Kpi label={t('admin.student.attendance')} value={`${stats.attendance || 0}%`} accent="success" hint={t('admin.student.attendanceHint')} />
        <Kpi label={t('admin.student.hwCompletion')} value={`${stats.hwCompletion || 0}%`} accent="primary" hint={t('admin.student.hwCompletionHint')} />
        <Kpi label={t('admin.student.hwOverdue')} value={stats.hwOverdue || 0} accent={stats.hwOverdue > 0 ? 'danger' : 'muted'} />
        <Kpi label={t('admin.student.avgQuiz')} value={`${stats.avgQuizScore || 0}%`} accent="primary" hint={t('admin.student.avgQuizHint')} />
        <Kpi label={t('admin.student.coursesCount')} value={sp?.courseAccesses?.length || 0} />
        <Kpi label={t('admin.student.groupsCount')} value={sp?.groups?.length || 0} />
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('students.profile')}</h3>
          <ProfRow label={t('profile.fullName')} value={u.fullName} />
          <ProfRow label={t('profile.login')} value={u.login} />
          <ProfRow label={t('auth.password')} value={u.plainPassword || '—'} mono />
          <ProfRow label={t('profile.email')} value={u.email} />
          <ProfRow label={t('profile.phone')} value={u.phone} />
          <ProfRow label={t('profile.telegram')} value={u.telegram} />
          <ProfRow label={t('profile.city')} value={u.city} />
          <ProfRow label={t('profile.goal')} value={u.goal} />
          <ProfRow label={t('admin.teacher.lastLogin')} value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'} />
          <ProfRow label={t('admin.teacher.createdAt')} value={new Date(u.createdAt).toLocaleDateString()} />
        </div>

        <div className="card">
          <h3>{t('admin.student.relations')}</h3>
          <ProfRow label={t('admin.student.teacher')} value={
            sp?.teacher
              ? <Link to={`/admin/teachers/${sp.teacher.id}`}>{sp.teacher.fullName}</Link>
              : '—'
          } />
          <ProfRow label={t('students.individualPrice')} value={sp?.individualPrice || '—'} />
          <ProfRow label={t('students.allowReschedule')} value={sp?.allowReschedule ? t('students.yes') : t('students.no')} />
          <h4 style={{ margin: '14px 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('admin.student.courses')}</h4>
          {(sp?.courseAccesses || []).map((a: any) => (
            <div key={a.id} className="list-item">
              <div>{a.course.title}</div>
              <div className="muted" style={{ fontSize: 11 }}>{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : '—'}</div>
            </div>
          ))}
          {(sp?.courseAccesses || []).length === 0 && <div className="empty">—</div>}
          <h4 style={{ margin: '14px 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('admin.student.groups')}</h4>
          {(sp?.groups || []).map((g: any) => (
            <div key={g.id} className="list-item">{g.group.name}</div>
          ))}
          {(sp?.groups || []).length === 0 && <div className="empty">—</div>}
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>{t('admin.student.payments')}</h3>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {(sp?.payments || []).map((p: any) => (
              <div key={p.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500, color: p.kind === 'TOPUP' ? 'var(--success)' : 'var(--danger)' }}>
                    {p.kind === 'TOPUP' ? '+' : '−'}{p.amount.toLocaleString()} ₽
                  </div>
                  {p.comment && <div className="muted" style={{ fontSize: 11 }}>{p.comment}</div>}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(p.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {(sp?.payments || []).length === 0 && <div className="empty">—</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>{t('admin.student.chatsAndMessages')}</h3>
          {(data.chats || []).length === 0 ? (
            <div className="empty">{t('admin.student.noChats')}</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {(data.chats || []).map((c: any) => {
                  const other = c.members?.find((m: any) => m.user?.id !== u.id);
                  const title = c.title || other?.user?.fullName || (c.type === 'SUPPORT' ? 'Support' : 'Чат');
                  return <span key={c.id} className="status-badge status-primary">{title}</span>;
                })}
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('admin.student.recentMessages')}</h4>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {(data.recentMessages || []).map((m: any) => (
                  <div key={m.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{m.sender?.fullName || '—'} {m.sender?.role && <span className="muted">[{m.sender.role}]</span>}</span>
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>{m.text || (m.kind || '—')}</div>
                  </div>
                ))}
                {(!data.recentMessages || data.recentMessages.length === 0) && <div className="empty">—</div>}
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>{t('admin.teacher.audit')}</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {(data.audit || []).map((a: any) => (
              <div key={a.id} className="audit-row">
                <span className="audit-action">{a.action}</span>
                <div style={{ minWidth: 0, flex: 1, fontSize: 12 }}>{a.actor?.fullName || '—'}</div>
                <span className="audit-time">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {(!data.audit || data.audit.length === 0) && <div className="empty">—</div>}
          </div>
        </div>
      </div>

      {transferOpen && sp && <TransferModal sp={sp} teachers={teachers || []} onClose={() => setTransferOpen(false)} onSaved={refetch} />}
      {tagsOpen && <TagsModal user={u} onClose={() => setTagsOpen(false)} onSaved={refetch} />}
    </Shell>
  );
}

function ProfRow({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'ui-monospace, monospace' : undefined, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function TransferModal({ sp, teachers, onClose, onSaved }: any) {
  const { t } = useT();
  const [tid, setTid] = useState(sp.teacherId);
  function save() {
    onClose();
    api.patch(`/admin/students/${sp.id}/transfer`, { newTeacherId: tid })
      .then(() => { toast.success(t('admin.student.transferred')); invalidateApi('/admin/students'); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={t('admin.student.transferTitle')} width={460}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="field"><label>{t('admin.student.newTeacher')}</label>
        <select className="select" value={tid} onChange={(e) => setTid(e.target.value)}>
          {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.fullName} ({t.login})</option>)}
        </select>
      </div>
    </Modal>
  );
}

function TagsModal({ user, onClose, onSaved }: any) {
  const { t } = useT();
  const [tags, setTags] = useState<string[]>((user.tags || '').split(',').filter(Boolean));
  function toggle(tag: string) {
    setTags((cur) => cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]);
  }
  function save() {
    onClose();
    api.patch(`/admin/students/${user.id}/tags`, { tags: tags.join(',') })
      .then(() => { toast.success(t('btn.save')); onSaved(); })
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={t('admin.student.tagsTitle')} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="manager-perm-grid">
        {TAG_OPTIONS.map((tag) => (
          <label key={tag}>
            <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggle(tag)} />
            #{tag}
          </label>
        ))}
      </div>
    </Modal>
  );
}
