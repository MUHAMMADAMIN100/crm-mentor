import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, MonthCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';

export function StudentCalendar() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], events: [] });
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [pickedEvent, setPickedEvent] = useState<any>(null);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    api.get('/calendar/student', { params: { from, to } }).then((r) => setData(r.data));
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
      <div className="flex" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <div style={{ fontWeight: 600 }}>{month.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <MonthCalendar month={month} events={events} onDayClick={setPickedDay} onEventClick={setPickedEvent} />

      {pickedDay && (
        <EventForm day={pickedDay} onClose={() => { setPickedDay(null); load(); }} />
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
  async function save() {
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    await api.post('/calendar/events', { title, startAt: dt.toISOString() });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Личное дело"
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save}>Создать</button></>}>
      <div className="field"><label>Название</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>Время</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
    </Modal>
  );
}

function RescheduleModal({ lesson, onClose }: any) {
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    if (!lesson) return;
    api.get(`/public/teachers/${lesson.teacherId}/slots`).then((r) => setSlots(r.data.slots));
  }, [lesson]);
  if (!lesson) return null;
  async function reschedule(slotId: string) {
    try {
      await api.post('/calendar/student/reschedule', { lessonId: lesson.id, freeSlotId: slotId });
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка переноса');
    }
  }
  return (
    <Modal open onClose={onClose} title="Урок">
      <p>{new Date(lesson.startAt).toLocaleString('ru-RU')}</p>
      {lesson.link && <p>Ссылка: <a href={lesson.link} target="_blank">{lesson.link}</a></p>}
      {lesson.type === 'INDIVIDUAL' && (
        <>
          <div className="h-divider" />
          <h4>Перенести на другое время</h4>
          <div className="list" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {slots.map((s) => (
              <div key={s.id} className="list-item">
                <div>{new Date(s.startAt).toLocaleString('ru-RU')}</div>
                <button className="btn btn-sm btn-primary" onClick={() => reschedule(s.id)}>Перенести</button>
              </div>
            ))}
            {slots.length === 0 && <div className="empty">Нет свободных окон</div>}
          </div>
        </>
      )}
    </Modal>
  );
}
