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

  function load() { api.get(`/students/${id}`).then((r) => setS(r.data)); }
  useEffect(load, [id]);

  async function toggleReschedule() {
    const next = !s.allowReschedule;
    setS((cur: any) => ({ ...cur, allowReschedule: next }));   // optimistic
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
    setS((cur: any) => ({ ...cur, individualPrice: v }));   // optimistic
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
    // Optimistic: bump balance and prepend payment row
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
      load();        // refresh in background to get the real payment row
    } catch (e: any) {
      setS(prev);
      toast.error(e?.response?.data?.message || t('finance.topup.err'));
    } finally {
      setTopping(false);
    }
  }
  async function openChat() {
    if (!s) return;
    try {
      await api.post(`/chat/private/${s.userId}`);
      nav('/teacher/messages');
    } catch { toast.error(t('chat.notOpened')); }
  }

  if (!s) return <Shell title={t('students.title')}><Loading label={t('loader.profile')} /></Shell>;
  return (
    <Shell title={s.user.fullName}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={openChat}>{t('btn.writeStudent')}</button>
      </div>
      <div className="cards-grid">
        <div className="card">
          <h3>{t('students.profile')}</h3>
          <p><span className="muted">{t('profile.email')}:</span> {s.user.email || '—'}</p>
          <p><span className="muted">{t('profile.phone')}:</span> {s.user.phone || '—'}</p>
          <p><span className="muted">{t('profile.goal')}:</span> {s.user.goal || '—'}</p>
          <p><span className="muted">{t('profile.bio')}:</span> {s.user.bio || '—'}</p>
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
          <h3>{t('students.history')}</h3>
          <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {s.payments.map((p: any) => (
              <div key={p.id} className="list-item">
                <div>{p.kind === 'TOPUP' ? '+ ' : p.kind === 'CHARGE' ? '− ' : ''}{p.amount}</div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(p.createdAt).toLocaleString()}</div>
              </div>
            ))}
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
    </Shell>
  );
}

/* ============================================================
   StudentCalendarCard — embedded month calendar with this
   student's lessons + teacher's free slots. Click a future day
   to add a free slot or a lesson with this student in one place.
   ============================================================ */

function StudentCalendarCard({ student }: { student: any }) {
  const { t } = useT();
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], freeSlots: [], events: [] });
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [pickedEvent, setPickedEvent] = useState<any>(null);
  const [creating, setCreating] = useState<'free' | 'lesson' | null>(null);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    api.get('/calendar', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch(() => toast.error(t('calendar.notLoaded')));
  }
  useEffect(load, [month]);

  // Show only events relevant to this student: their lessons + all free slots
  // (the student could potentially be moved to any free window).
  const events: CalEvent[] = useMemo(() => {
    const now = new Date();
    const studentLessons = data.lessons.filter((l: any) => l.studentProfileId === student.id);
    return [
      ...studentLessons.map((l: any) => ({
        id: 'L' + l.id,
        title: student.user.fullName,
        startAt: l.startAt,
        variant: l.status === 'COMPLETED' ? 'completed' : (new Date(l.startAt) < now ? 'past' : 'lesson'),
      })),
      ...data.freeSlots.map((sl: any) => ({
        id: 'F' + sl.id,
        title: t('calendar.freeShort'),
        startAt: sl.startAt,
        variant: 'free' as const,
      })),
    ];
  }, [data, student, t]);

  /** Drag-drop: move lesson/slot to another day, optimistic. */
  async function handleEventMove(eventId: string, targetDay: Date) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (targetDay < todayStart) { toast.warning(t('toast.error')); return; }
    const prefix = eventId[0];
    const id = eventId.slice(1);
    const arr = prefix === 'L' ? 'lessons' : 'freeSlots';
    const url = prefix === 'L' ? `/calendar/lessons/${id}` : `/calendar/free-slots/${id}`;
    const item = (data as any)[arr].find((x: any) => x.id === id);
    if (!item) return;
    const old = new Date(item.startAt);
    if (isSameDay(old, targetDay)) return;
    const newDate = new Date(targetDay);
    newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);

    const prev = data;
    setData((d: any) => ({
      ...d,
      [arr]: d[arr].map((x: any) => x.id === id ? { ...x, startAt: newDate.toISOString() } : x),
    }));
    try {
      await api.patch(url, { startAt: newDate.toISOString() });
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
        onDayClick={(d) => { setPickedDay(d); setCreating(null); }}
        onEventClick={(ev) => setPickedEvent(ev)}
        onEventMove={handleEventMove}
      />

      {pickedDay && !creating && (
        <Modal open onClose={() => setPickedDay(null)} title={pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} width={460}>
          <div className="flex-col">
            <button className="btn btn-primary" onClick={() => setCreating('free')}>{t('btn.createFreeSlot')}</button>
            <button className="btn" onClick={() => setCreating('lesson')}>{t('btn.createLesson')}</button>
          </div>
        </Modal>
      )}

      {pickedDay && creating === 'free' && (
        <FreeSlotMini day={pickedDay} onClose={(saved: boolean) => { setPickedDay(null); setCreating(null); if (saved) load(); }} />
      )}
      {pickedDay && creating === 'lesson' && (
        <LessonMini day={pickedDay} student={student} onClose={(saved: boolean) => { setPickedDay(null); setCreating(null); if (saved) load(); }} />
      )}

      {pickedEvent && pickedEvent.id.startsWith('L') && (
        <LessonInfo
          lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)}
          onClose={(refresh: boolean) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
      {pickedEvent && pickedEvent.id.startsWith('F') && (
        <FreeSlotInfo
          slot={data.freeSlots.find((sl: any) => 'F' + sl.id === pickedEvent.id)}
          onClose={(refresh: boolean) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
    </div>
  );
}

function FreeSlotMini({ day, onClose }: any) {
  const { t } = useT();
  const [timeFrom, setTimeFrom] = useState('12:00');
  const [timeTo, setTimeTo] = useState('13:00');
  const [saving, setSaving] = useState(false);
  async function save() {
    const dt = combineDayTime(day, timeFrom);
    const durationMin = durationFromTimes(timeFrom, timeTo);
    setSaving(true);
    try {
      await api.post('/calendar/free-slots', { startAt: dt.toISOString(), durationMin });
      toast.success(t('calendar.slotCreated'));
      onClose(true);
    } catch { toast.error(t('toast.notCreated')); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.free')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{t('btn.create')}</button></>}>
      <div className="row">
        <div className="field"><label>{t('calendar.timeFrom')}</label><input className="input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} /></div>
        <div className="field"><label>{t('calendar.timeTo')}</label><input className="input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function LessonMini({ day, student, onClose }: any) {
  const { t } = useT();
  const [form, setForm] = useState({ timeFrom: '12:00', timeTo: '13:00', link: '', comment: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    const dt = combineDayTime(day, form.timeFrom);
    const durationMin = durationFromTimes(form.timeFrom, form.timeTo);
    setSaving(true);
    try {
      await api.post('/calendar/lessons', {
        type: 'INDIVIDUAL',
        studentProfileId: student.id,
        startAt: dt.toISOString(),
        durationMin,
        link: form.link || null,
        comment: form.comment || null,
      });
      toast.success(t('calendar.lessonCreated'));
      onClose(true);
    } catch { toast.error(t('toast.notCreated')); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.lessonNew')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{t('btn.create')}</button></>}>
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

function LessonInfo({ lesson, onClose }: any) {
  const { t } = useT();
  if (!lesson) return null;
  async function complete() {
    try {
      await api.post(`/calendar/lessons/${lesson.id}/complete`);
      toast.success(t('calendar.lessonCompleted'));
      onClose(true);
    } catch (e: any) { toast.error(e?.response?.data?.message || t('toast.error')); }
  }
  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDelete'), body: t('calendar.confirmDeleteBody'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    try {
      await api.delete(`/calendar/lessons/${lesson.id}`);
      toast.success(t('calendar.lessonDeleted'));
      onClose(true);
    } catch { toast.error(t('toast.notDeleted')); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.lesson')}>
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

function FreeSlotInfo({ slot, onClose }: any) {
  const { t } = useT();
  if (!slot) return null;
  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDeleteSlot'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    try {
      await api.delete(`/calendar/free-slots/${slot.id}`);
      toast.success(t('calendar.slotDeleted'));
      onClose(true);
    } catch { toast.error(t('toast.notDeleted')); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.free')}>
      <p>{new Date(slot.startAt).toLocaleString()} · {slot.durationMin} {t('misc.duration60')}</p>
      {slot.takenName && <p className="muted">{t('calendar.bookedBy')}: {slot.takenName}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>{t('btn.delete')}</button>
      </div>
    </Modal>
  );
}
