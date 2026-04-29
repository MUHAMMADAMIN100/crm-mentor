import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, MonthCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function StudentCalendar() {
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
      .catch(() => toast.error('Не удалось загрузить календарь'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [month]);

  const events: CalEvent[] = [
    ...data.lessons.map((l: any) => ({
      id: 'L' + l.id, title: l.type === 'GROUP' ? 'Группа' : 'Урок', startAt: l.startAt,
      variant: (new Date(l.startAt) < new Date() ? 'past' : 'lesson') as any,
    })),
    ...data.events.map((e: any) => ({ id: 'E' + e.id, title: e.title, startAt: e.startAt, variant: 'event' as const })),
  ];

  return (
    <Shell title="Календарь">
      <div className="cal-toolbar">
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <div className="cal-month">{month.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        <button className="btn" onClick={() => setMonth(new Date())}>Сегодня</button>
      </div>

      {loading && events.length === 0 ? (
        <div className="card"><Loading label="Загружаем календарь…" /></div>
      ) : (
        <MonthCalendar month={month} events={events} onDayClick={(d) => { setPickedDay(d); setCreating(false); }} onEventClick={setPickedEvent} />
      )}

      {pickedDay && !creating && (
        <Modal open onClose={() => setPickedDay(null)} title={pickedDay.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} width={460}>
          <div className="day-detail-list" style={{ marginBottom: 14 }}>
            {events.filter((e) => isSameDay(new Date(e.startAt), pickedDay)).map((e) => (
              <div key={e.id} className={`day-detail-item ${e.variant}`} onClick={() => { setPickedDay(null); setPickedEvent(e); }}>
                <div className="vbar" />
                <div className="time">{new Date(e.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ flex: 1 }}>{e.title}</div>
              </div>
            ))}
            {events.filter((e) => isSameDay(new Date(e.startAt), pickedDay)).length === 0 && <div className="empty">В этот день событий нет</div>}
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCreating(true)}>+ Личное дело</button>
        </Modal>
      )}

      {pickedDay && creating && (
        <EventForm day={pickedDay} onClose={(saved) => { setPickedDay(null); setCreating(false); if (saved) load(); }} />
      )}
      {pickedEvent?.id?.startsWith?.('L') && (
        <RescheduleModal lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)} onClose={() => { setPickedEvent(null); load(); }} />
      )}
    </Shell>
  );
}

function EventForm({ day, onClose }: any) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('12:00');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!title.trim()) { toast.warning('Введите название'); return; }
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    setSaving(true);
    try {
      await api.post('/calendar/events', { title, startAt: dt.toISOString() });
      toast.success('Событие добавлено');
      onClose(true);
    } catch { toast.error('Не удалось сохранить'); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title="Личное дело"
      footer={<><button className="btn" onClick={() => onClose(false)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>Создать</button></>}>
      <div className="field"><label>Название</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="field"><label>Время</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
    </Modal>
  );
}

function RescheduleModal({ lesson, onClose }: any) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!lesson) return;
    api.get(`/public/teachers/${lesson.teacherId}/slots`)
      .then((r) => setSlots(r.data.slots))
      .finally(() => setLoading(false));
  }, [lesson]);
  if (!lesson) return null;
  async function reschedule(slotId: string) {
    try {
      await api.post('/calendar/student/reschedule', { lessonId: lesson.id, freeSlotId: slotId });
      toast.success('Урок перенесён');
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ошибка переноса');
    }
  }
  return (
    <Modal open onClose={onClose} title="Урок">
      <p>{new Date(lesson.startAt).toLocaleString('ru-RU')}</p>
      {lesson.link && <p>Ссылка: <a href={lesson.link} target="_blank" rel="noreferrer">{lesson.link}</a></p>}
      {lesson.type === 'INDIVIDUAL' && (
        <>
          <div className="h-divider" />
          <h4 style={{ margin: '0 0 8px' }}>Перенести на другое время</h4>
          {loading ? <Loading label="Ищем свободные окна…" /> : (
            <div className="list" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {slots.map((s) => (
                <div key={s.id} className="list-item">
                  <div>{new Date(s.startAt).toLocaleString('ru-RU')}</div>
                  <button className="btn btn-sm btn-primary" onClick={() => reschedule(s.id)}>Перенести</button>
                </div>
              ))}
              {slots.length === 0 && <div className="empty">Нет свободных окон</div>}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
