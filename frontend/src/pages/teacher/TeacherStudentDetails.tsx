import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { TreeView } from '../../components/Tree';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { ResponsiveCalendar, CalEvent } from '../../components/Calendar';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function combineDayTime(day: Date, time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(day);
  dt.setHours(hh || 0, mm || 0, 0, 0);
  return dt;
}
function durationFromTimes(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const min = (th * 60 + tm) - (fh * 60 + fm);
  return min > 0 ? min : 60;
}

export function TeacherStudentDetails() {
  const { t } = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<any>(null);
  const [topup, setTopup] = useState({ amount: 0, comment: '' });
  const [topping, setTopping] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  function load() { api.get(`/students/${id}`).then((r) => setS(r.data)); }
  useEffect(load, [id]);

  async function toggleReschedule() {
    const next = !s.allowReschedule;
    setS((cur: any) => ({ ...cur, allowReschedule: next }));
    try {
      await api.patch(`/students/${id}`, { allowReschedule: next });
      toast.success(t('finance.settings'));
    } catch {
      setS((cur: any) => ({ ...cur, allowReschedule: !next }));
      toast.error(t('toast.notUpdated'));
    }
  }
  async function setPrice(v: number) {
    const old = s.individualPrice;
    setS((cur: any) => ({ ...cur, individualPrice: v }));
    try {
      await api.patch(`/students/${id}`, { individualPrice: v });
      toast.success(t('finance.priceUpdated'));
    } catch {
      setS((cur: any) => ({ ...cur, individualPrice: old }));
      toast.error(t('toast.notUpdated'));
    }
  }
  async function doTopup() {
    if (!topup.amount || topup.amount <= 0) { toast.warning(t('finance.topup.errPositive')); return; }
    const amount = topup.amount;
    const comment = topup.comment;
    setTopping(true);
    const prev = s;
    setS((cur: any) => ({
      ...cur,
      balance: (cur.balance || 0) + amount,
      payments: [{ id: `tmp-${Date.now()}`, kind: 'TOPUP', amount, comment, createdAt: new Date().toISOString() }, ...(cur.payments || [])],
    }));
    setTopup({ amount: 0, comment: '' });
    try {
      await api.post(`/finance/teacher/students/${id}/topup`, { amount, comment });
      toast.success(`${t('finance.topup.success')} +${amount}`);
      load();
    } catch (e: any) {
      setS(prev);
      toast.error(e?.response?.data?.message || t('finance.topup.err'));
    } finally {
      setTopping(false);
    }
  }
  function openChat() {
    if (!s) return;
    // Navigate immediately — chat creation is idempotent and runs in background.
    nav('/teacher/messages');
    api.post(`/chat/private/${s.userId}`).catch(() => toast.error(t('chat.notOpened')));
  }

  if (!s) return <Shell title={t('students.title')}><Loading label={t('loader.profile')} /></Shell>;

  return (
    <Shell title={s.user.fullName}>
      {/* Top-right action: chat with this student. Floats to the right on tablets+, full width on phones. */}
      <div className="student-top-actions">
        <button className="btn btn-primary" onClick={openChat}>{t('btn.writeStudent')}</button>
      </div>

      <div className="student-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{t('students.profile')}</h3>
            <button className="btn btn-sm" onClick={() => setEditProfileOpen(true)}>✏️ {t('btn.edit')}</button>
          </div>
          <div className="profile-rows">
            <ProfRow label={t('profile.email')} value={s.user.email} />
            <ProfRow label={t('profile.phone')} value={s.user.phone} />
            <ProfRow label={t('profile.telegram')} value={s.user.telegram} />
            <ProfRow label={t('profile.whatsapp')} value={s.user.whatsapp} />
            <ProfRow label={t('profile.instagram')} value={s.user.instagram} />
            <ProfRow label={t('profile.website')} value={s.user.website} />
            <ProfRow label={t('profile.city')} value={s.user.city} />
            <ProfRow label={t('profile.goal')} value={s.user.goal} />
            <ProfRow label={t('profile.bio')} value={s.user.bio} />
          </div>
        </div>

        <div className="card">
          <h3>{t('settings.title')}</h3>
          <div className="field">
            <label><input type="checkbox" checked={s.allowReschedule} onChange={toggleReschedule} /> {t('students.allowReschedule2')}</label>
          </div>
          <div className="field">
            <label>{t('students.individualPrice')}</label>
            <input className="input" type="number" defaultValue={s.individualPrice || 0} onBlur={(e) => setPrice(+e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h3>{t('students.tree')}</h3>
          <TreeView tree={s.tree} />
        </div>

        <div className="card">
          <h3>{t('students.balanceTitle')} <span style={{ color: s.balance < 0 ? 'var(--danger)' : 'var(--primary)' }}>{s.balance}</span></h3>
          <div className="row">
            <input className="input" type="number" placeholder={t('teachers.amount')} value={topup.amount || ''} onChange={(e) => setTopup({ ...topup, amount: +e.target.value })} />
            <input className="input" placeholder={t('calendar.comment')} value={topup.comment} onChange={(e) => setTopup({ ...topup, comment: e.target.value })} />
            <button className="btn btn-primary" onClick={doTopup} disabled={topping}>{topping ? '…' : t('btn.topup')}</button>
          </div>
          <div className="h-divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{t('students.history')}</h4>
          <div className="payment-history">
            {(s.payments || []).length === 0 && <div className="empty" style={{ padding: '12px 0' }}>—</div>}
            {(s.payments || []).map((p: any) => {
              const kind = p.kind;
              const sign = kind === 'TOPUP' ? '+' : kind === 'CHARGE' ? '−' : '±';
              const color = kind === 'TOPUP' ? 'var(--success)' : kind === 'CHARGE' ? 'var(--danger)' : 'var(--text-muted)';
              const label = kind === 'TOPUP' ? 'Поступление' : kind === 'CHARGE' ? 'Списание' : 'Корректировка';
              return (
                <div key={p.id} className="payment-row">
                  <div className="payment-amount" style={{ color }}>{sign}{p.amount}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="payment-label">{label}</div>
                    {p.comment && <div className="payment-comment muted">{p.comment}</div>}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>{new Date(p.createdAt).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3>{t('students.courseAccess')}</h3>
          <div className="list">
            {s.courseAccesses.map((a: any) => (
              <div key={a.id} className="list-item">
                <div>{a.course.title}</div>
                <div className="muted">{a.expiresAt ? `${t('course.untilDate')} ${new Date(a.expiresAt).toLocaleDateString()}` : t('course.indef')}</div>
              </div>
            ))}
            {s.courseAccesses.length === 0 && <div className="empty">{t('empty.noAccesses')}</div>}
          </div>
        </div>
      </div>

      <StudentCalendarCard student={s} />

      {editProfileOpen && (
        <EditProfileModal
          student={s}
          onSaved={(updatedUser: any) => {
            // Optimistic merge — UI updates instantly while the request flies.
            setS((cur: any) => cur ? { ...cur, user: { ...cur.user, ...updatedUser } } : cur);
          }}
          onRollback={(prevUser: any) => {
            // Request failed — restore the old user fields.
            setS((cur: any) => cur ? { ...cur, user: prevUser } : cur);
          }}
          onClose={() => setEditProfileOpen(false)}
        />
      )}
    </Shell>
  );
}

function ProfRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="profile-row">
      <span className="profile-label">{label}</span>
      <span className="profile-value">{value || '—'}</span>
    </div>
  );
}

function EditProfileModal({ student, onClose, onSaved, onRollback }: any) {
  const { t } = useT();
  const u = student.user || {};
  const [form, setForm] = useState({
    fullName: u.fullName || '',
    login: u.login || '',
    password: u.plainPassword || '',
    email: u.email || '',
    phone: u.phone || '',
    telegram: u.telegram || '',
    whatsapp: u.whatsapp || '',
    instagram: u.instagram || '',
    website: u.website || '',
    city: u.city || '',
    goal: u.goal || '',
    bio: u.bio || '',
  });
  function up(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function save() {
    const payload: any = { ...form };
    // Only send password/login when they actually changed.
    if (!payload.password || payload.password === (u.plainPassword || '')) delete payload.password;
    if (!payload.login || payload.login.trim() === (u.login || '')) delete payload.login;

    // Optimistic merge — apply locally, then close immediately. Request runs in background.
    const optimisticUser = {
      ...u,
      fullName: form.fullName,
      login: form.login || u.login,
      plainPassword: form.password || u.plainPassword,
      email: form.email,
      phone: form.phone,
      telegram: form.telegram,
      whatsapp: form.whatsapp,
      instagram: form.instagram,
      website: form.website,
      city: form.city,
      goal: form.goal,
      bio: form.bio,
    };
    onSaved?.(optimisticUser);
    onClose();

    api.patch(`/students/${student.id}/profile`, payload)
      .then(() => toast.success(t('profile.updated')))
      .catch((e: any) => {
        onRollback?.(u);
        toast.error(e?.response?.data?.message || t('toast.notSaved'));
      });
  }

  return (
    <Modal open onClose={onClose} title={t('profile.editBtn')} width={920}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('profile.saveBtn')}</button></>}>
      <div className="modal-form-2col">
        <section>
          <h4 className="modal-section-title">{t('students.profile')}</h4>
          <div className="field"><label>{t('profile.fullName')}</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} /></div>
          <div className="field"><label>{t('profile.login')}</label><input className="input" value={form.login} onChange={(e) => up('login', e.target.value)} /></div>
          <div className="field"><label>{t('auth.password')}</label>
            <input className="input" type="text" value={form.password} onChange={(e) => up('password', e.target.value)} />
          </div>
          <div className="field"><label>{t('profile.city')}</label><input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>
          <div className="field"><label>{t('profile.goal')}</label><input className="input" value={form.goal} onChange={(e) => up('goal', e.target.value)} /></div>
          <div className="field"><label>{t('profile.bio')}</label><textarea className="textarea" value={form.bio} onChange={(e) => up('bio', e.target.value)} /></div>
        </section>

        <section>
          <h4 className="modal-section-title">Контакты</h4>
          <div className="field"><label>{t('profile.email')}</label><input className="input" type="email" value={form.email} onChange={(e) => up('email', e.target.value)} /></div>
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

/* ============================================================
   StudentCalendarCard — only shows lessons of THIS student.
   Click future day → directly add a lesson with this student
   (no "free slot" option — those are global, not per-student).
   ============================================================ */
function StudentCalendarCard({ student }: { student: any }) {
  const { t } = useT();
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], freeSlots: [], events: [] });
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [pickedEvent, setPickedEvent] = useState<any>(null);
  const [creatingLesson, setCreatingLesson] = useState(false);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    api.get('/calendar', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch(() => {
        setTimeout(() => {
          api.get('/calendar', { params: { from, to } })
            .then((r) => setData(r.data))
            .catch(() => toast.error(t('calendar.notLoaded')));
        }, 1500);
      });
  }
  useEffect(load, [month]);

  const events: CalEvent[] = useMemo(() => {
    const now = new Date();
    return data.lessons
      .filter((l: any) => l.studentProfileId === student.id)
      .map((l: any) => ({
        id: 'L' + l.id,
        title: student.user.fullName,
        startAt: l.startAt,
        variant: l.status === 'COMPLETED' ? 'completed' : (new Date(l.startAt) < now ? 'past' : 'lesson'),
      }));
  }, [data, student]);

  async function handleEventMove(eventId: string, targetDay: Date) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (targetDay < todayStart) { toast.warning(t('toast.error')); return; }
    if (!eventId.startsWith('L')) return;
    const id = eventId.slice(1);
    const item = data.lessons.find((x: any) => x.id === id);
    if (!item) return;
    const old = new Date(item.startAt);
    if (isSameDay(old, targetDay)) return;
    const newDate = new Date(targetDay);
    newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);

    const prev = data;
    setData((d: any) => ({
      ...d,
      lessons: d.lessons.map((x: any) => x.id === id ? { ...x, startAt: newDate.toISOString() } : x),
    }));
    try {
      await api.patch(`/calendar/lessons/${id}`, { startAt: newDate.toISOString() });
      toast.success(t('calendar.movedTo'));
    } catch {
      setData(prev);
      toast.error(t('toast.notUpdated'));
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{t('calendar.title')}</h3>
        <div className="cal-toolbar" style={{ margin: 0 }}>
          <button className="btn btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <div className="cal-month" style={{ minWidth: 130, fontSize: 14 }}>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button className="btn btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          <button className="btn btn-sm" onClick={() => setMonth(new Date())}>{t('btn.today')}</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t('calendar.dragHint')}</div>

      <ResponsiveCalendar
        month={month}
        events={events}
        onDayClick={(d) => { setPickedDay(d); setCreatingLesson(false); }}
        onEventClick={(ev) => setPickedEvent(ev)}
        onEventMove={handleEventMove}
      />

      {pickedDay && !creatingLesson && (
        <Modal open onClose={() => setPickedDay(null)} title={pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} width={420}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCreatingLesson(true)}>{t('btn.createLesson')}</button>
        </Modal>
      )}

      {pickedDay && creatingLesson && (
        <LessonMini
          day={pickedDay}
          student={student}
          onClose={() => { setPickedDay(null); setCreatingLesson(false); }}
          onOptimistic={(payload: any) => {
            const tempId = `tmp-${Date.now()}`;
            const optimistic = {
              id: tempId,
              type: 'INDIVIDUAL',
              studentProfileId: student.id,
              status: 'PLANNED',
              ...payload,
              __optimistic: true,
            };
            setData((d: any) => ({ ...d, lessons: [...d.lessons, optimistic] }));
            api.post('/calendar/lessons', payload)
              .then((r) => {
                setData((d: any) => ({
                  ...d,
                  lessons: d.lessons.map((x: any) => x.id === tempId ? r.data : x),
                }));
                toast.success(t('calendar.lessonCreated'));
              })
              .catch(() => {
                setData((d: any) => ({ ...d, lessons: d.lessons.filter((x: any) => x.id !== tempId) }));
                toast.error(t('toast.notCreated'));
              });
          }}
        />
      )}

      {pickedEvent && pickedEvent.id.startsWith('L') && (
        <LessonInfo
          lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)}
          onOptimisticDelete={(id: string) => {
            const prev = data;
            setData((d: any) => ({ ...d, lessons: d.lessons.filter((x: any) => x.id !== id) }));
            api.delete(`/calendar/lessons/${id}`)
              .then(() => toast.success(t('calendar.lessonDeleted')))
              .catch(() => { setData(prev); toast.error(t('toast.notDeleted')); });
          }}
          onOptimisticComplete={(id: string) => {
            const prev = data;
            setData((d: any) => ({
              ...d,
              lessons: d.lessons.map((x: any) => x.id === id ? { ...x, status: 'COMPLETED' } : x),
            }));
            api.post(`/calendar/lessons/${id}/complete`)
              .then(() => { toast.success(t('calendar.lessonCompleted')); load(); })
              .catch((e: any) => { setData(prev); toast.error(e?.response?.data?.message || t('toast.error')); });
          }}
          onClose={() => setPickedEvent(null)}
        />
      )}
    </div>
  );
}

function LessonMini({ day, student, onClose, onOptimistic }: any) {
  const { t } = useT();
  const [form, setForm] = useState({ timeFrom: '12:00', timeTo: '13:00', link: '', comment: '' });
  function save() {
    const dt = combineDayTime(day, form.timeFrom);
    const durationMin = durationFromTimes(form.timeFrom, form.timeTo);
    onClose();
    onOptimistic?.({
      type: 'INDIVIDUAL',
      studentProfileId: student.id,
      startAt: dt.toISOString(),
      durationMin,
      link: form.link || null,
      comment: form.comment || null,
    });
  }
  return (
    <Modal open onClose={onClose} title={t('calendar.lessonNew')}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.create')}</button></>}>
      <p className="muted" style={{ marginTop: 0 }}>{t('calendar.student')}: <strong>{student.user.fullName}</strong></p>
      <div className="row">
        <div className="field"><label>{t('calendar.timeFrom')}</label><input className="input" type="time" value={form.timeFrom} onChange={(e) => setForm({ ...form, timeFrom: e.target.value })} /></div>
        <div className="field"><label>{t('calendar.timeTo')}</label><input className="input" type="time" value={form.timeTo} onChange={(e) => setForm({ ...form, timeTo: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t('calendar.link')}</label><input className="input" placeholder="https://…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
      <div className="field"><label>{t('calendar.comment')}</label><textarea className="textarea" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
    </Modal>
  );
}

function LessonInfo({ lesson, onClose, onOptimisticDelete, onOptimisticComplete }: any) {
  const { t } = useT();
  if (!lesson) return null;
  function complete() {
    onClose();
    onOptimisticComplete?.(lesson.id);
  }
  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDelete'), body: t('calendar.confirmDeleteBody'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    onClose();
    onOptimisticDelete?.(lesson.id);
  }
  return (
    <Modal open onClose={onClose} title={t('calendar.lesson')}>
      <p>{new Date(lesson.startAt).toLocaleString()} · {lesson.durationMin} {t('misc.duration60')}</p>
      <p className="muted">{t('calendar.status')}: {t(`lesson.${lesson.status}` as any) || lesson.status}</p>
      {lesson.link && <p>{t('calendar.linkLabel')}: <a href={lesson.link} target="_blank" rel="noreferrer">{lesson.link}</a></p>}
      {lesson.comment && <p>{lesson.comment}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>{t('btn.delete')}</button>
        <button className="btn btn-primary" onClick={complete} disabled={lesson.status === 'COMPLETED'}>
          {lesson.status === 'COMPLETED' ? t('btn.alreadyCompleted') : t('btn.markComplete')}
        </button>
      </div>
    </Modal>
  );
}
