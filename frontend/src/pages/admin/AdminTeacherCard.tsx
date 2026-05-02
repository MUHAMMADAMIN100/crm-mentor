import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { useApi } from '../../hooks';
import { api, invalidateApi } from '../../api';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge, Kpi } from '../../components/AdminUI';

export function AdminTeacherCard() {
  const { t } = useT();
  const { id } = useParams();
  const { data, refetch } = useApi<any>(`/admin/teachers/${id}`);
  const [editOpen, setEditOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [subEditOpen, setSubEditOpen] = useState(false);

  if (!data) return <Shell title={t('admin.teacher.cardTitle')}><Loading label={t('loader.profile')} /></Shell>;

  const u = data.teacher;
  const sub = u.teacherSubscription;
  const stats = data.stats;
  const audit = data.audit || [];

  async function archive() {
    const ok = await confirmDialog({
      title: t('admin.teacher.confirmArchive'),
      body: t('admin.teacher.confirmArchiveBody'),
      okLabel: t('btn.archive'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${u.id}/archive`, { reason: 'admin manual archive' });
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(t('teachers.archived'));
    } catch { toast.error(t('toast.error')); }
  }

  async function unarchive() {
    try {
      await api.patch(`/admin/users/${u.id}/unarchive`);
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(t('teachers.unarchived'));
    } catch { toast.error(t('toast.error')); }
  }

  return (
    <Shell title={u.fullName}>
      <div className="flex" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link to="/admin/teachers" className="btn btn-sm">← {t('btn.back')}</Link>
        <div className="spacer" />
        {sub && <StatusBadge status={sub.status} />}
        {u.archived && <StatusBadge status="ARCHIVED" />}
        <button className="btn btn-sm" onClick={() => setSubEditOpen(true)}>{t('admin.teacher.editSub')}</button>
        <button className="btn btn-sm btn-primary" onClick={() => setExtendOpen(true)}>{t('admin.teacher.extendSub')}</button>
        <button className="btn btn-sm" onClick={() => setEditOpen(true)}>{t('btn.edit')}</button>
        {u.archived
          ? <button className="btn btn-sm" onClick={unarchive}>{t('btn.unarchive')}</button>
          : <button className="btn btn-sm btn-danger" onClick={archive}>{t('btn.archive')}</button>}
      </div>

      <div className="kpi-grid">
        <Kpi label={t('admin.teacher.studentsCount')} value={u._count.teacherStudents} />
        <Kpi label={t('admin.teacher.coursesCount')} value={u._count.teacherCourses} />
        <Kpi label={t('admin.teacher.groupsCount')} value={u._count.teacherGroups} />
        <Kpi label={t('admin.teacher.lessonsTotal')} value={u._count.teacherLessons} />
        <Kpi label={t('admin.teacher.lessonsCompleted')} value={stats.lessonsCompleted} accent="success" />
        <Kpi label={t('admin.teacher.lessonsPlanned')} value={stats.lessonsPlanned} accent="primary" />
        <Kpi label={t('admin.teacher.studentIncoming')} value={`${(stats.studentIncoming || 0).toLocaleString()} ₽`} accent="success" hint={t('admin.teacher.studentIncomingHint')} />
        <Kpi label={t('admin.teacher.studentCharged')} value={`${(stats.studentCharged || 0).toLocaleString()} ₽`} accent="primary" hint={t('admin.teacher.studentChargedHint')} />
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('admin.teacher.profile')}</h3>
          <ProfRow label={t('profile.fullName')} value={u.fullName} />
          <ProfRow label={t('profile.login')} value={u.login} />
          <ProfRow label={t('auth.password')} value={u.plainPassword || '—'} mono />
          <ProfRow label={t('profile.email')} value={u.email} />
          <ProfRow label={t('profile.phone')} value={u.phone} />
          <ProfRow label={t('profile.telegram')} value={u.telegram} />
          <ProfRow label={t('profile.whatsapp')} value={u.whatsapp} />
          <ProfRow label={t('profile.city')} value={u.city} />
          <ProfRow label={t('profile.category')} value={u.category} />
          <ProfRow label={t('admin.teacher.lastLogin')} value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'} />
          <ProfRow label={t('admin.teacher.createdAt')} value={new Date(u.createdAt).toLocaleDateString()} />
          {u.archiveReason && <ProfRow label={t('admin.teacher.archiveReason')} value={u.archiveReason} />}
        </div>

        <div className="card">
          <h3>{t('admin.teacher.subscriptionTitle')}</h3>
          {sub ? (
            <>
              <ProfRow label={t('teachers.subscription')} value={<StatusBadge status={sub.status} />} />
              <ProfRow label={t('teachers.subscriptionTitle')} value={sub.type || '—'} />
              <ProfRow label={t('teachers.start')} value={sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '—'} />
              <ProfRow label={t('teachers.end')} value={sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '—'} />
              <ProfRow label={t('teachers.amount')} value={sub.amount ? `${sub.amount.toLocaleString()} ${sub.currency || '₽'}` : '—'} />
              {sub.source && <ProfRow label={t('admin.sub.source')} value={sub.source} />}
              {sub.comment && <ProfRow label={t('admin.sub.comment')} value={sub.comment} />}
              {sub.history && sub.history.length > 0 && (
                <>
                  <div className="h-divider" />
                  <h4 style={{ margin: '0 0 8px' }}>{t('admin.sub.history')}</h4>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {sub.history.map((h: any) => (
                      <div key={h.id} className="audit-row">
                        <span className="audit-action">{h.action}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13 }}>
                            {h.prevStatus && h.nextStatus && h.prevStatus !== h.nextStatus
                              ? `${h.prevStatus} → ${h.nextStatus}`
                              : h.nextStatus}
                          </div>
                          {h.actor && <div className="audit-target">{h.actor.fullName}</div>}
                          {h.comment && <div className="audit-target">{h.comment}</div>}
                        </div>
                        <span className="audit-time">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : <div className="empty">{t('admin.sub.none')}</div>}
        </div>
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('admin.teacher.studentsList')} ({u.teacherStudents.length})</h3>
          <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {u.teacherStudents.map((s: any) => (
              <div key={s.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{s.user.fullName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{s.user.login}</div>
                </div>
                {s.user.archived && <StatusBadge status="ARCHIVED" />}
              </div>
            ))}
            {u.teacherStudents.length === 0 && <div className="empty">—</div>}
          </div>
        </div>

        <div className="card">
          <h3>{t('admin.teacher.coursesList')} ({u.teacherCourses.length})</h3>
          <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {u.teacherCourses.map((c: any) => (
              <div key={c.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{c._count.modules} {t('admin.teacher.modules')} · {c._count.accesses} {t('admin.teacher.accesses')}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {u.teacherCourses.length === 0 && <div className="empty">—</div>}
          </div>
        </div>

        <div className="card">
          <h3>{t('admin.teacher.recentLessons')}</h3>
          <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {data.recentLessons.map((l: any) => (
              <div key={l.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{new Date(l.startAt).toLocaleString()}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{l.type} · {l.durationMin} {t('misc.duration60')}</div>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
            {data.recentLessons.length === 0 && <div className="empty">—</div>}
          </div>
        </div>

        <div className="card">
          <h3>{t('admin.teacher.studentPayments')}</h3>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {(data.recentStudentPayments || []).map((p: any) => (
              <div key={p.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500, color: p.kind === 'TOPUP' ? 'var(--success)' : 'var(--danger)' }}>
                    {p.kind === 'TOPUP' ? '+' : '−'}{(p.amount || 0).toLocaleString()} ₽
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.student?.user?.fullName || '—'} {p.comment ? `· ${p.comment}` : ''}</div>
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(p.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {(!data.recentStudentPayments || data.recentStudentPayments.length === 0) && <div className="empty">—</div>}
          </div>
        </div>

        <div className="card">
          <h3>{t('admin.teacher.audit')}</h3>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {audit.map((a: any) => (
              <div key={a.id} className="audit-row">
                <span className="audit-action">{a.action}</span>
                <div style={{ minWidth: 0, flex: 1, fontSize: 12 }}>{a.actor?.fullName || '—'}</div>
                <span className="audit-time">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {audit.length === 0 && <div className="empty">—</div>}
          </div>
        </div>
      </div>

      {editOpen && <EditTeacherModal teacher={u} onClose={() => setEditOpen(false)} onSaved={refetch} />}
      {subEditOpen && <SubscriptionModal teacher={u} sub={sub} onClose={() => setSubEditOpen(false)} onSaved={refetch} />}
      {extendOpen && <ExtendSubModal teacher={u} sub={sub} onClose={() => setExtendOpen(false)} onSaved={refetch} />}
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

function EditTeacherModal({ teacher, onClose, onSaved }: any) {
  const { t } = useT();
  const [form, setForm] = useState({
    fullName: teacher.fullName || '',
    login: teacher.login || '',
    password: teacher.plainPassword || '',
    email: teacher.email || '',
    phone: teacher.phone || '',
    telegram: teacher.telegram || '',
    whatsapp: teacher.whatsapp || '',
    instagram: teacher.instagram || '',
    website: teacher.website || '',
    city: teacher.city || '',
    category: teacher.category || '',
  });
  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  function save() {
    const payload: any = { ...form };
    if (payload.password === (teacher.plainPassword || '')) delete payload.password;
    if (payload.login === (teacher.login || '')) delete payload.login;
    onClose();
    api.patch(`/admin/teachers/${teacher.id}`, payload)
      .then(() => { toast.success(t('profile.updated')); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={t('admin.teacher.editTitle')} width={760}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="modal-form-2col">
        <section>
          <h4 className="modal-section-title">{t('students.profile')}</h4>
          <div className="field"><label>{t('profile.fullName')}</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} /></div>
          <div className="field"><label>{t('profile.login')}</label><input className="input" value={form.login} onChange={(e) => up('login', e.target.value)} /></div>
          <div className="field"><label>{t('auth.password')}</label><input className="input" type="text" value={form.password} onChange={(e) => up('password', e.target.value)} /></div>
          <div className="field"><label>{t('profile.city')}</label><input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>
          <div className="field"><label>{t('profile.category')}</label><input className="input" value={form.category} onChange={(e) => up('category', e.target.value)} /></div>
        </section>
        <section>
          <h4 className="modal-section-title">{t('admin.teacher.contacts')}</h4>
          <div className="field"><label>{t('profile.email')}</label><input className="input" value={form.email} onChange={(e) => up('email', e.target.value)} /></div>
          <div className="field"><label>{t('profile.phone')}</label><input className="input" value={form.phone} onChange={(e) => up('phone', e.target.value)} /></div>
          <div className="field"><label>{t('profile.telegram')}</label><input className="input" value={form.telegram} onChange={(e) => up('telegram', e.target.value)} /></div>
          <div className="field"><label>{t('profile.whatsapp')}</label><input className="input" value={form.whatsapp} onChange={(e) => up('whatsapp', e.target.value)} /></div>
          <div className="field"><label>{t('profile.instagram')}</label><input className="input" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} /></div>
          <div className="field"><label>{t('profile.website')}</label><input className="input" value={form.website} onChange={(e) => up('website', e.target.value)} /></div>
        </section>
      </div>
    </Modal>
  );
}

function SubscriptionModal({ teacher, sub, onClose, onSaved }: any) {
  const { t } = useT();
  const [form, setForm] = useState({
    status: sub?.status || 'TRIAL',
    type: sub?.type || 'MONTH',
    startDate: sub?.startDate ? sub.startDate.slice(0, 10) : '',
    endDate: sub?.endDate ? sub.endDate.slice(0, 10) : '',
    amount: sub?.amount || 0,
    currency: sub?.currency || 'RUB',
    source: sub?.source || 'manual_admin',
    comment: sub?.comment || '',
  });
  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  function save() {
    onClose();
    api.patch(`/admin/teachers/${teacher.id}/subscription`, form)
      .then(() => { toast.success(t('teachers.subUpdated')); invalidateApi('/admin/teachers'); onSaved(); })
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={t('admin.sub.editTitle')} width={520}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="row">
        <div className="field"><label>{t('teachers.subscription')}</label>
          <select className="select" value={form.status} onChange={(e) => up('status', e.target.value)}>
            <option value="TRIAL">TRIAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="PAUSED">PAUSED</option>
            <option value="CANCELED">CANCELED</option>
          </select>
        </div>
        <div className="field"><label>{t('teachers.subscriptionTitle')}</label>
          <select className="select" value={form.type} onChange={(e) => up('type', e.target.value)}>
            <option value="MONTH">{t('teachers.month')}</option>
            <option value="YEAR">{t('teachers.year')}</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field"><label>{t('teachers.start')}</label><input type="date" className="input" value={form.startDate} onChange={(e) => up('startDate', e.target.value)} /></div>
        <div className="field"><label>{t('teachers.end')}</label><input type="date" className="input" value={form.endDate} onChange={(e) => up('endDate', e.target.value)} /></div>
      </div>
      <div className="row">
        <div className="field"><label>{t('teachers.amount')}</label><input type="number" className="input" value={form.amount} onChange={(e) => up('amount', +e.target.value)} /></div>
        <div className="field"><label>{t('admin.sub.currency')}</label>
          <select className="select" value={form.currency} onChange={(e) => up('currency', e.target.value)}>
            <option>RUB</option><option>USD</option><option>EUR</option><option>KZT</option><option>UZS</option>
          </select>
        </div>
      </div>
      <div className="field"><label>{t('admin.sub.source')}</label><input className="input" value={form.source} onChange={(e) => up('source', e.target.value)} /></div>
      <div className="field"><label>{t('admin.sub.comment')}</label><textarea className="textarea" value={form.comment} onChange={(e) => up('comment', e.target.value)} /></div>
    </Modal>
  );
}

function ExtendSubModal({ teacher, sub, onClose, onSaved }: any) {
  const { t } = useT();
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(sub?.amount || 0);
  const [comment, setComment] = useState('');

  function save() {
    if (!sub) { toast.error(t('admin.sub.none')); return; }
    onClose();
    api.post(`/admin/teachers/${teacher.id}/subscription/extend`, { months, amount, comment })
      .then(() => { toast.success(t('admin.sub.extended')); invalidateApi('/admin/teachers'); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={t('admin.sub.extendTitle')} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('admin.sub.extend')}</button></>}>
      <div className="field"><label>{t('admin.sub.months')}</label>
        <select className="select" value={months} onChange={(e) => setMonths(+e.target.value)}>
          <option value="1">+1 мес.</option>
          <option value="3">+3 мес.</option>
          <option value="6">+6 мес.</option>
          <option value="12">+12 мес.</option>
        </select>
      </div>
      <div className="field"><label>{t('teachers.amount')}</label><input type="number" className="input" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
      <div className="field"><label>{t('admin.sub.comment')}</label><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}
