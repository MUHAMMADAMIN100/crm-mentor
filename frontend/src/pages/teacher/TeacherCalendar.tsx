import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, ResponsiveCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

type Action = 'lesson' | 'free' | 'event' | null;

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
function timeAfterMinutes(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  const h = Math.floor((total / 60) % 24);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TeacherCalendar() {
  const { t } = useT();
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], freeSlots: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [pickedEvent, setPickedEvent] = useState<any>(null);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    setLoading(true);
    api.get('/calendar', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch(() => toast.error(t('calendar.notLoaded')))
      .finally(() => setLoading(false));
  }
  useEffect(load, [month]);

  useEffect(() => {
    api.get('/students').then((r) => setStudents(r.data));
    api.get('/groups').then((r) => setGroups(r.data));
  }, []);

  const events: CalEvent[] = useMemo(() => {
    const now = new Date();
    return [
      ...data.lessons.map((l: any) => ({
        id: 'L' + l.id,
        title: lessonTitle(l, students, groups, t),
        startAt: l.startAt,
        variant: l.status === 'COMPLETED' ? 'completed' : (new Date(l.startAt) < now ? 'past' : 'lesson'),
      })),
      ...data.freeSlots.map((s: any) => ({ id: 'F' + s.id, title: t('calendar.freeShort'), startAt: s.startAt, variant: 'free' as const })),
      ...data.events.map((e: any) => ({ id: 'E' + e.id, title: e.title, startAt: e.startAt, variant: 'event' as const })),
    ];
  }, [data, students, groups, t]);

  function goToday() { setMonth(new Date()); }

  async function copyPublicLink() {
    try {
      const me = await api.get('/auth/me');
      const url = `${location.origin}/book/${me.data.id}`;
      await navigator.clipboard.writeText(url);
      toast.success(t('toast.copied'), t('toast.success'));
    } catch {
      toast.error(t('toast.notCopied'));
    }
  }

  /** Drag-drop: move event to another day, keeping the time. Optimistic. */
  async function handleEventMove(eventId: string, targetDay: Date) {
    const prefix = eventId[0];
    const id = eventId.slice(1);
    const arr = prefix === 'L' ? 'lessons' : prefix === 'F' ? 'freeSlots' : 'events';
    const url = prefix === 'L' ? `/calendar/lessons/${id}`
      : prefix === 'F' ? `/calendar/free-slots/${id}`
      : `/calendar/events/${id}`;
    const item = (data as any)[arr].find((x: any) => x.id === id);
    if (!item) return;
    const old = new Date(item.startAt);
    if (isSameDay(old, targetDay)) return;
    const newDate = new Date(targetDay);
    newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);

    // Optimistic update — UI changes instantly
    const prev = data;
    setData((d: any) => ({
      ...d,
      [arr]: d[arr].map((x: any) => x.id === id ? { ...x, startAt: newDate.toISOString() } : x),
    }));

    try {
      await api.patch(url, { startAt: newDate.toISOString() });
      toast.success(t('calendar.movedTo'));
    } catch {
      // Rollback
      setData(prev);
      toast.error(t('toast.notUpdated'));
    }
  }

  /** Optimistic delete by event prefix + id. */
  async function deleteByEventId(eventId: string) {
    const prefix = eventId[0];
    const id = eventId.slice(1);
    const arr = prefix === 'L' ? 'lessons' : prefix === 'F' ? 'freeSlots' : 'events';
    const url = prefix === 'L' ? `/calendar/lessons/${id}`
      : prefix === 'F' ? `/calendar/free-slots/${id}`
      : `/calendar/events/${id}`;
    const prev = data;
    setData((d: any) => ({ ...d, [arr]: d[arr].filter((x: any) => x.id !== id) }));
    try {
      await api.delete(url);
    } catch {
      setData(prev);
      toast.error(t('toast.notDeleted'));
      throw new Error('failed');
    }
  }

  /** Optimistic complete lesson. */
  async function completeLessonOpt(id: string) {
    const prev = data;
    setData((d: any) => ({
      ...d,
      lessons: d.lessons.map((x: any) => x.id === id ? { ...x, status: 'COMPLETED', charged: true } : x),
    }));
    try {
      await api.post(`/calendar/lessons/${id}/complete`);
      // Refresh in background to get accurate priceCharged etc.
      load();
    } catch (e: any) {
      setData(prev);
      toast.error(e?.response?.data?.message || t('toast.error'));
      throw e;
    }
  }

  return (
    <Shell title={t('calendar.title')}>
      <div className="cal-toolbar">
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="‹">‹</button>
        <div className="cal-month">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="›">›</button>
        <button className="btn" onClick={goToday}>{t('btn.today')}</button>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={copyPublicLink}>{t('btn.copyLink')}</button>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t('calendar.dragHint')}</div>

      {loading && events.length === 0 ? (
        <div className="card"><Loading label={t('loader.calendar')} /></div>
      ) : (
        <ResponsiveCalendar
          month={month}
          events={events}
          onDayClick={(d) => { setPickedDay(d); setAction(null); }}
          onEventClick={(ev) => setPickedEvent(ev)}
          onEventMove={handleEventMove}
        />
      )}

      {pickedDay && !action && (
        <DayDetail
          day={pickedDay}
          events={events.filter((e) => isSameDay(new Date(e.startAt), pickedDay))}
          onClose={() => setPickedDay(null)}
          onCreate={(a) => setAction(a)}
          onEventClick={(ev) => { setPickedDay(null); setPickedEvent(ev); }}
        />
      )}

      {pickedDay && action === 'lesson' && (
        <LessonForm day={pickedDay} students={students} groups={groups} onClose={(saved) => { setPickedDay(null); setAction(null); if (saved) load(); }} />
      )}
      {pickedDay && action === 'free' && (
        <FreeSlotForm day={pickedDay} onClose={(saved) => { setPickedDay(null); setAction(null); if (saved) load(); }} />
      )}
      {pickedDay && action === 'event' && (
        <EventForm day={pickedDay} onClose={(saved) => { setPickedDay(null); setAction(null); if (saved) load(); }} />
      )}

      {pickedEvent && pickedEvent.id.startsWith('L') && (
        <LessonActions
          lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)}
          students={students}
          groups={groups}
          studentName={pickedEvent.title}
          onComplete={completeLessonOpt}
          onDelete={deleteByEventId}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
      {pickedEvent && pickedEvent.id.startsWith('F') && (
        <FreeSlotActions
          slot={data.freeSlots.find((s: any) => 'F' + s.id === pickedEvent.id)}
          onDelete={deleteByEventId}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
      {pickedEvent && pickedEvent.id.startsWith('E') && (
        <EventActions
          ev={data.events.find((e: any) => 'E' + e.id === pickedEvent.id)}
          onDelete={deleteByEventId}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
    </Shell>
  );
}

function lessonTitle(l: any, students: any[], groups: any[], t: any) {
  if (l.type === 'INDIVIDUAL') {
    const s = students.find((x) => x.id === l.studentProfileId);
    return s?.user?.fullName || t('misc.unknownStudent');
  }
  const g = groups.find((x) => x.id === l.groupId);
  return g?.name || t('calendar.group');
}
function variantLabel(v: string, t: any) {
  return ({
    lesson: t('calendar.lesson'),
    completed: t('calendar.completed'),
    past: t('calendar.past'),
    free: t('calendar.free'),
    event: t('calendar.event'),
  } as any)[v] || v;
}

function DayDetail({ day, events, onClose, onCreate, onEventClick }: any) {
  const { t } = useT();
  const sorted = [...events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  return (
    <Modal open onClose={onClose} title={day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} width={520}>
      {sorted.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-soft)', fontWeight: 500 }}>{t('calendar.events')}</h4>
          <div className="day-detail-list" style={{ marginBottom: 16 }}>
            {sorted.map((e: any) => (
              <div key={e.id} className={`day-detail-item ${e.variant}`} onClick={() => onEventClick(e)}>
                <div className="vbar" />
                <div className="time">{new Date(e.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{variantLabel(e.variant, t)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-soft)', fontWeight: 500 }}>{t('calendar.add')}</h4>
      <div className="flex-col">
        <button className="btn btn-primary" onClick={() => onCreate('lesson')}>{t('btn.createLesson')}</button>
        <button className="btn" onClick={() => onCreate('free')}>{t('btn.createFreeSlot')}</button>
        <button className="btn" onClick={() => onCreate('event')}>{t('btn.createEvent')}</button>
      </div>
    </Modal>
  );
}

function LessonForm({ day, students, groups, onClose, initial }: any) {
  const { t } = useT();
  const init = initial || { type: 'INDIVIDUAL', studentProfileId: '', groupId: '', timeFrom: '12:00', timeTo: '13:00', link: '', comment: '' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (form.type === 'INDIVIDUAL' && !form.studentProfileId) { toast.warning(t('calendar.student')); return; }
    if (form.type === 'GROUP' && !form.groupId) { toast.warning(t('calendar.group')); return; }
    const dt = combineDayTime(day, form.timeFrom);
    const durationMin = durationFromTimes(form.timeFrom, form.timeTo);
    setSaving(true);
    try {
      if (initial && initial.id) {
        await api.patch(`/calendar/lessons/${initial.id}`, {
          startAt: dt.toISOString(),
          durationMin,
          link: form.link || null,
          comment: form.comment || null,
        });
        toast.success(t('course.lessonSaved'));
      } else {
        await api.post('/calendar/lessons', {
          type: form.type,
          studentProfileId: form.type === 'INDIVIDUAL' ? form.studentProfileId : null,
          groupId: form.type === 'GROUP' ? form.groupId : null,
          startAt: dt.toISOString(),
          durationMin,
          link: form.link, comment: form.comment,
        });
        toast.success(t('calendar.lessonCreated'));
      }
      onClose(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('toast.notCreated'));
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={initial ? t('course.lessonEdit') : t('calendar.lessonNew')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('status.saving') : (initial ? t('btn.save') : t('btn.create'))}</button></>}>
      {!initial && (
        <div className="field"><label>{t('calendar.type')}</label>
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="INDIVIDUAL">{t('calendar.individualLesson')}</option>
            <option value="GROUP">{t('calendar.groupLesson')}</option>
          </select>
        </div>
      )}
      {!initial && form.type === 'INDIVIDUAL' && (
        <div className="field"><label>{t('calendar.student')}</label>
          <select className="select" value={form.studentProfileId} onChange={(e) => setForm({ ...form, studentProfileId: e.target.value })}>
            <option value="">— {t('btn.choose')} —</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.fullName}</option>)}
          </select>
        </div>
      )}
      {!initial && form.type === 'GROUP' && (
        <div className="field"><label>{t('calendar.group')}</label>
          <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
            <option value="">— {t('btn.choose')} —</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}
      <div className="row">
        <div className="field"><label>{t('calendar.timeFrom')}</label>
          <input className="input" type="time" value={form.timeFrom}
            onChange={(e) => {
              const newFrom = e.target.value;
              const dur = durationFromTimes(form.timeFrom, form.timeTo);
              setForm({ ...form, timeFrom: newFrom, timeTo: timeAfterMinutes(newFrom, dur) });
            }} />
        </div>
        <div className="field"><label>{t('calendar.timeTo')}</label>
          <input className="input" type="time" value={form.timeTo} onChange={(e) => setForm({ ...form, timeTo: e.target.value })} />
        </div>
      </div>
      <div className="field"><label>{t('calendar.link')}</label><input className="input" placeholder="https://…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
      <div className="field"><label>{t('calendar.comment')}</label><textarea className="textarea" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
    </Modal>
  );
}

function FreeSlotForm({ day, onClose, initial }: any) {
  const { t } = useT();
  const init = initial || { timeFrom: '12:00', timeTo: '13:00' };
  const [timeFrom, setTimeFrom] = useState(init.timeFrom);
  const [timeTo, setTimeTo] = useState(init.timeTo);
  const [saving, setSaving] = useState(false);
  async function save() {
    const dt = combineDayTime(day, timeFrom);
    const durationMin = durationFromTimes(timeFrom, timeTo);
    setSaving(true);
    try {
      if (initial && initial.id) {
        await api.patch(`/calendar/free-slots/${initial.id}`, { startAt: dt.toISOString(), durationMin });
      } else {
        await api.post('/calendar/free-slots', { startAt: dt.toISOString(), durationMin });
      }
      toast.success(initial ? t('btn.save') : t('calendar.slotCreated'));
      onClose(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('toast.notCreated'));
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.free')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{initial ? t('btn.save') : t('btn.create')}</button></>}>
      <div className="row">
        <div className="field"><label>{t('calendar.timeFrom')}</label><input className="input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} /></div>
        <div className="field"><label>{t('calendar.timeTo')}</label><input className="input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function EventForm({ day, onClose, initial }: any) {
  const { t } = useT();
  const init = initial || { title: '', timeFrom: '12:00', timeTo: '13:00', reminder: false, description: '' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.title.trim()) { toast.warning(t('groups.fillName')); return; }
    const dt = combineDayTime(day, form.timeFrom);
    setSaving(true);
    try {
      if (initial && initial.id) {
        await api.patch(`/calendar/events/${initial.id}`, {
          title: form.title,
          startAt: dt.toISOString(),
          reminder: form.reminder,
          description: form.description,
        });
        toast.success(t('btn.save'));
      } else {
        await api.post('/calendar/events', { ...form, startAt: dt.toISOString() });
        toast.success(t('calendar.eventCreated'));
      }
      onClose(true);
    } catch { toast.error(t('toast.notSaved')); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.event')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{initial ? t('btn.save') : t('btn.create')}</button></>}>
      <div className="field"><label>{t('calendar.title2')}</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label>{t('calendar.timeFrom')}</label><input className="input" type="time" value={form.timeFrom} onChange={(e) => setForm({ ...form, timeFrom: e.target.value })} /></div>
        <div className="field"><label>{t('calendar.timeTo')}</label><input className="input" type="time" value={form.timeTo} onChange={(e) => setForm({ ...form, timeTo: e.target.value })} /></div>
      </div>
      <div className="field"><label><input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} /> {t('calendar.reminder')}</label></div>
      <div className="field"><label>{t('calendar.description')}</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
    </Modal>
  );
}

function LessonActions({ lesson, students, groups, studentName, onComplete, onDelete, onClose }: any) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!lesson) return null;

  if (editing) {
    const start = new Date(lesson.startAt);
    const end = new Date(start.getTime() + (lesson.durationMin || 60) * 60000);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const initial = {
      id: lesson.id,
      type: lesson.type,
      studentProfileId: lesson.studentProfileId,
      groupId: lesson.groupId,
      timeFrom: fmt(start),
      timeTo: fmt(end),
      link: lesson.link || '',
      comment: lesson.comment || '',
    };
    return <LessonForm day={start} students={students} groups={groups} initial={initial} onClose={(saved: boolean) => { setEditing(false); if (saved) onClose(true); }} />;
  }

  async function complete() {
    onClose(false);
    try {
      await onComplete(lesson.id);
      toast.success(t('calendar.lessonCompleted'));
    } catch {}
  }
  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDelete'), body: t('calendar.confirmDeleteBody'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    onClose(false);
    try {
      await onDelete('L' + lesson.id);
      toast.success(t('calendar.lessonDeleted'));
    } catch {}
  }
  return (
    <Modal open onClose={() => onClose(false)} title={studentName || t('calendar.lesson')}>
      <p style={{ margin: 0 }}>{new Date(lesson.startAt).toLocaleString()} · {lesson.durationMin} {t('misc.duration60')}</p>
      <p className="muted" style={{ marginTop: 6 }}>{t('calendar.status')}: {t(`lesson.${lesson.status}` as any) || lesson.status}</p>
      {lesson.link && <p>{t('calendar.linkLabel')}: <a href={lesson.link} target="_blank" rel="noreferrer">{lesson.link}</a></p>}
      {lesson.comment && <p>{lesson.comment}</p>}
      <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-danger" onClick={del}>{t('btn.delete')}</button>
        <button className="btn" onClick={() => setEditing(true)}>{t('btn.edit')}</button>
        <button className="btn btn-primary" onClick={complete} disabled={lesson.status === 'COMPLETED'}>
          {lesson.status === 'COMPLETED' ? t('btn.alreadyCompleted') : t('btn.markComplete')}
        </button>
      </div>
    </Modal>
  );
}

function FreeSlotActions({ slot, onDelete, onClose }: any) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!slot) return null;

  if (editing) {
    const start = new Date(slot.startAt);
    const end = new Date(start.getTime() + (slot.durationMin || 60) * 60000);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <FreeSlotForm day={start} initial={{ id: slot.id, timeFrom: fmt(start), timeTo: fmt(end) }}
      onClose={(saved: boolean) => { setEditing(false); if (saved) onClose(true); }} />;
  }

  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDeleteSlot'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    onClose(false);
    try {
      await onDelete('F' + slot.id);
      toast.success(t('calendar.slotDeleted'));
    } catch {}
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.free')}>
      <p>{new Date(slot.startAt).toLocaleString()} · {slot.durationMin} {t('misc.duration60')}</p>
      {slot.takenName && <p className="muted">{t('calendar.bookedBy')}: {slot.takenName}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>{t('btn.delete')}</button>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>{t('btn.edit')}</button>
      </div>
    </Modal>
  );
}

function EventActions({ ev, onDelete, onClose }: any) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!ev) return null;

  if (editing) {
    const start = new Date(ev.startAt);
    const end = new Date(start.getTime() + 60 * 60000);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <EventForm day={start}
      initial={{ id: ev.id, title: ev.title, timeFrom: fmt(start), timeTo: fmt(end), reminder: ev.reminder, description: ev.description || '' }}
      onClose={(saved: boolean) => { setEditing(false); if (saved) onClose(true); }} />;
  }

  async function del() {
    const ok = await confirmDialog({ title: t('calendar.confirmDeleteEvent'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    onClose(false);
    try {
      await onDelete('E' + ev.id);
      toast.success(t('calendar.eventDeleted'));
    } catch {}
  }
  return (
    <Modal open onClose={() => onClose(false)} title={ev.title}>
      <p>{new Date(ev.startAt).toLocaleString()}</p>
      {ev.description && <p>{ev.description}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>{t('btn.delete')}</button>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>{t('btn.edit')}</button>
      </div>
    </Modal>
  );
}
