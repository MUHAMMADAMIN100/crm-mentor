import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, ResponsiveCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';
import { useT } from '../../i18n';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function StudentCalendar() {
  const { t } = useT();
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickedEvent, setPickedEvent] = useState<any>(null);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    setLoading(true);
    api.get('/calendar/student', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch(() => {
        // Silent retry once for cold-start
        setTimeout(() => {
          api.get('/calendar/student', { params: { from, to } })
            .then((r) => setData(r.data))
            .catch(() => toast.error(t('calendar.notLoaded')));
        }, 1500);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [month]);

  const events: CalEvent[] = [
    ...data.lessons.map((l: any) => ({
      id: 'L' + l.id, title: l.type === 'GROUP' ? t('calendar.group') : t('calendar.lesson'), startAt: l.startAt,
      variant: (new Date(l.startAt) < new Date() ? 'past' : 'lesson') as any,
    })),
    ...data.events.map((e: any) => ({ id: 'E' + e.id, title: e.title, startAt: e.startAt, variant: 'event' as const })),
  ];

  async function handleEventMove(eventId: string, targetDay: Date) {
    if (!eventId.startsWith('E')) return; // student can move only own events
    // Disallow dropping into past days
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (targetDay < todayStart) {
      toast.warning(t('toast.error'));
      return;
    }
    const id = eventId.slice(1);
    const ev = data.events.find((x: any) => x.id === id);
    if (!ev) return;
    const old = new Date(ev.startAt);
    if (isSameDay(old, targetDay)) return;
    const newDate = new Date(targetDay);
    newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);
    // Optimistic update
    const prev = data;
    setData((d: any) => ({
      ...d,
      events: d.events.map((x: any) => x.id === id ? { ...x, startAt: newDate.toISOString() } : x),
    }));
    try {
      await api.patch(`/calendar/events/${id}`, { startAt: newDate.toISOString() });
      toast.success(t('calendar.movedTo'));
    } catch {
      setData(prev);
      toast.error(t('toast.notUpdated'));
    }
  }

  return (
    <Shell title={t('calendar.title')}>
      <div className="cal-toolbar">
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <div className="cal-month">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        <button className="btn" onClick={() => setMonth(new Date())}>{t('btn.today')}</button>
      </div>

      {loading && events.length === 0 ? (
        <div className="card"><Loading label={t('loader.calendar')} /></div>
      ) : (
        <ResponsiveCalendar month={month} events={events}
          onDayClick={(d) => { setPickedDay(d); setCreating(false); }}
          onEventClick={setPickedEvent}
          onEventMove={handleEventMove} />
      )}

      {pickedDay && !creating && (
        <Modal open onClose={() => setPickedDay(null)} title={pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} width={460}>
          <div className="day-detail-list" style={{ marginBottom: 14 }}>
            {events.filter((e) => isSameDay(new Date(e.startAt), pickedDay)).map((e) => (
              <div key={e.id} className={`day-detail-item ${e.variant}`} onClick={() => { setPickedDay(null); setPickedEvent(e); }}>
                <div className="vbar" />
                <div className="time">{new Date(e.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ flex: 1 }}>{e.title}</div>
              </div>
            ))}
            {events.filter((e) => isSameDay(new Date(e.startAt), pickedDay)).length === 0 && <div className="empty">{t('empty.noEvents')}</div>}
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCreating(true)}>{t('btn.createEvent')}</button>
        </Modal>
      )}

      {pickedDay && creating && (
        <EventForm day={pickedDay} onClose={(saved) => { setPickedDay(null); setCreating(false); if (saved) load(); }} />
      )}
      {pickedEvent?.id?.startsWith?.('L') && (
        <RescheduleModal lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)} onClose={() => { setPickedEvent(null); load(); }} />
      )}
      {pickedEvent?.id?.startsWith?.('E') && (
        <StudentEventActions ev={data.events.find((e: any) => 'E' + e.id === pickedEvent.id)}
          onClose={(refresh: boolean) => { setPickedEvent(null); if (refresh) load(); }} />
      )}
    </Shell>
  );
}

function EventForm({ day, onClose, initial }: any) {
  const { t } = useT();
  const init = initial || { title: '', time: '12:00' };
  const [title, setTitle] = useState(init.title);
  const [time, setTime] = useState(init.time);
  function save() {
    if (!title.trim()) { toast.warning(t('groups.fillName')); return; }
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    onClose(true);
    const req = initial && initial.id
      ? api.patch(`/calendar/events/${initial.id}`, { title, startAt: dt.toISOString() })
      : api.post('/calendar/events', { title, startAt: dt.toISOString() });
    req
      .then(() => toast.success(initial ? t('btn.save') : t('calendar.eventCreated')))
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={() => onClose(false)} title={t('calendar.event')}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{initial ? t('btn.save') : t('btn.create')}</button></>}>
      <div className="field"><label>{t('calendar.title2')}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="field"><label>{t('calendar.time')}</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
    </Modal>
  );
}

function RescheduleModal({ lesson, onClose }: any) {
  const { t } = useT();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!lesson) return;
    api.get(`/public/teachers/${lesson.teacherId}/slots`)
      .then((r) => setSlots(r.data.slots))
      .finally(() => setLoading(false));
  }, [lesson]);
  if (!lesson) return null;
  function reschedule(slotId: string) {
    onClose();
    api.post('/calendar/student/reschedule', { lessonId: lesson.id, freeSlotId: slotId })
      .then(() => toast.success(t('calendar.rescheduled')))
      .catch((e: any) => toast.error(e?.response?.data?.message || t('calendar.lessonCantReschedule')));
  }
  return (
    <Modal open onClose={onClose} title={t('calendar.lesson')}>
      <p>{new Date(lesson.startAt).toLocaleString()}</p>
      {lesson.link && <p>{t('calendar.linkLabel')}: <a href={lesson.link} target="_blank" rel="noreferrer">{lesson.link}</a></p>}
      {lesson.type === 'INDIVIDUAL' && (
        <>
          <div className="h-divider" />
          <h4 style={{ margin: '0 0 8px' }}>{t('calendar.rescheduleSection')}</h4>
          {loading ? <Loading label={t('calendar.searchSlots')} /> : (
            <div className="list" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {slots.map((s) => (
                <div key={s.id} className="list-item">
                  <div>{new Date(s.startAt).toLocaleString()}</div>
                  <button className="btn btn-sm btn-primary" onClick={() => reschedule(s.id)}>{t('btn.reschedule')}</button>
                </div>
              ))}
              {slots.length === 0 && <div className="empty">{t('empty.noFreeSlots')}</div>}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function StudentEventActions({ ev, onClose }: { ev: any; onClose: (r: boolean) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!ev) return null;
  if (editing) {
    const start = new Date(ev.startAt);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <EventForm day={start}
      initial={{ id: ev.id, title: ev.title, time: fmt(start) }}
      onClose={(s: boolean) => { setEditing(false); if (s) onClose(true); }} />;
  }
  async function del() {
    onClose(true);  // close modal & let parent reload — server handles deletion
    try {
      await api.delete(`/calendar/events/${ev.id}`);
      toast.success(t('calendar.eventDeleted'));
    } catch { toast.error(t('toast.notDeleted')); }
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
