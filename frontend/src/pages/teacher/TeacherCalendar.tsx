import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, MonthCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';

type Action = 'lesson' | 'free' | 'event' | null;

export function TeacherCalendar() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<any>({ lessons: [], freeSlots: [], events: [] });
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [pickedEvent, setPickedEvent] = useState<any>(null);

  function load() {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
    api.get('/calendar', { params: { from, to } }).then((r) => setData(r.data));
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
        id: 'L' + l.id, title: lessonTitle(l, students, groups), startAt: l.startAt,
        variant: l.status === 'COMPLETED' ? 'completed' : (new Date(l.startAt) < now ? 'past' : 'lesson'),
      })),
      ...data.freeSlots.map((s: any) => ({ id: 'F' + s.id, title: 'Свободно', startAt: s.startAt, variant: 'free' as const })),
      ...data.events.map((e: any) => ({ id: 'E' + e.id, title: e.title, startAt: e.startAt, variant: 'event' as const })),
    ];
  }, [data, students, groups]);

  return (
    <Shell title="Календарь">
      <div className="flex" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <div style={{ fontWeight: 600 }}>{month.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={() => copyPublicLink()}>Скопировать ссылку записи</button>
      </div>

      <MonthCalendar
        month={month}
        events={events}
        onDayClick={(d) => { setPickedDay(d); setAction(null); }}
        onEventClick={(ev) => setPickedEvent(ev)}
      />

      {pickedDay && !action && (
        <Modal open onClose={() => setPickedDay(null)} title={pickedDay.toLocaleDateString('ru-RU')}>
          <div className="flex-col">
            <button className="btn btn-primary" onClick={() => setAction('lesson')}>Создать урок</button>
            <button className="btn" onClick={() => setAction('free')}>Создать свободное окно</button>
            <button className="btn" onClick={() => setAction('event')}>Создать личное дело</button>
          </div>
        </Modal>
      )}

      {pickedDay && action === 'lesson' && (
        <LessonForm day={pickedDay} students={students} groups={groups} onClose={() => { setPickedDay(null); setAction(null); load(); }} />
      )}
      {pickedDay && action === 'free' && (
        <FreeSlotForm day={pickedDay} onClose={() => { setPickedDay(null); setAction(null); load(); }} />
      )}
      {pickedDay && action === 'event' && (
        <EventForm day={pickedDay} onClose={() => { setPickedDay(null); setAction(null); load(); }} />
      )}

      {pickedEvent && pickedEvent.id.startsWith('L') && (
        <LessonActions
          lesson={data.lessons.find((l: any) => 'L' + l.id === pickedEvent.id)}
          onClose={() => { setPickedEvent(null); load(); }}
        />
      )}
    </Shell>
  );
}

async function copyPublicLink() {
  const me = await api.get('/auth/me');
  const url = `${location.origin}/book/${me.data.id}`;
  await navigator.clipboard.writeText(url);
  alert('Ссылка скопирована: ' + url);
}

function lessonTitle(l: any, students: any[], groups: any[]) {
  if (l.type === 'INDIVIDUAL') {
    const s = students.find((x) => x.id === l.studentProfileId);
    return s?.user?.fullName || 'Урок';
  }
  const g = groups.find((x) => x.id === l.groupId);
  return g?.name || 'Группа';
}

function LessonForm({ day, students, groups, onClose }: any) {
  const [form, setForm] = useState({
    type: 'INDIVIDUAL', studentProfileId: '', groupId: '',
    time: '12:00', durationMin: 60, link: '', comment: '',
  });
  async function save() {
    const [hh, mm] = form.time.split(':').map(Number);
    const dt = new Date(day);
    dt.setHours(hh, mm, 0, 0);
    await api.post('/calendar/lessons', {
      type: form.type,
      studentProfileId: form.type === 'INDIVIDUAL' ? form.studentProfileId : null,
      groupId: form.type === 'GROUP' ? form.groupId : null,
      startAt: dt.toISOString(),
      durationMin: form.durationMin,
      link: form.link, comment: form.comment,
    });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Новый урок"
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save}>Создать</button></>}>
      <div className="field"><label>Тип</label>
        <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="INDIVIDUAL">Индивидуальный</option><option value="GROUP">Групповой</option>
        </select>
      </div>
      {form.type === 'INDIVIDUAL' ? (
        <div className="field"><label>Ученик</label>
          <select className="select" value={form.studentProfileId} onChange={(e) => setForm({ ...form, studentProfileId: e.target.value })}>
            <option value="">—</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.fullName}</option>)}
          </select>
        </div>
      ) : (
        <div className="field"><label>Группа</label>
          <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
            <option value="">—</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}
      <div className="row">
        <div className="field"><label>Время</label><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
        <div className="field"><label>Длительность, мин</label><input className="input" type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: +e.target.value })} /></div>
      </div>
      <div className="field"><label>Ссылка (Zoom/Meet)</label><input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
      <div className="field"><label>Комментарий</label><textarea className="textarea" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
    </Modal>
  );
}

function FreeSlotForm({ day, onClose }: any) {
  const [time, setTime] = useState('12:00');
  const [dur, setDur] = useState(60);
  async function save() {
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    await api.post('/calendar/free-slots', { startAt: dt.toISOString(), durationMin: dur });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Свободное окно"
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save}>Создать</button></>}>
      <div className="row">
        <div className="field"><label>Время</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="field"><label>Длительность, мин</label><input className="input" type="number" value={dur} onChange={(e) => setDur(+e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function EventForm({ day, onClose }: any) {
  const [form, setForm] = useState({ title: '', time: '12:00', reminder: false, description: '' });
  async function save() {
    const [hh, mm] = form.time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    await api.post('/calendar/events', { ...form, startAt: dt.toISOString() });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Личное дело"
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save}>Создать</button></>}>
      <div className="field"><label>Название</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="field"><label>Время</label><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
      <div className="field"><label><input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} /> Напоминание</label></div>
      <div className="field"><label>Описание</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
    </Modal>
  );
}

function LessonActions({ lesson, onClose }: any) {
  if (!lesson) return null;
  async function complete() {
    await api.post(`/calendar/lessons/${lesson.id}/complete`);
    onClose();
  }
  async function del() {
    if (!confirm('Удалить урок?')) return;
    await api.delete(`/calendar/lessons/${lesson.id}`);
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Урок">
      <p>{new Date(lesson.startAt).toLocaleString('ru-RU')} · {lesson.durationMin} мин</p>
      <p className="muted">Статус: {lesson.status}</p>
      {lesson.link && <p>Ссылка: <a href={lesson.link} target="_blank">{lesson.link}</a></p>}
      {lesson.comment && <p>{lesson.comment}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>Удалить</button>
        <button className="btn btn-primary" onClick={complete} disabled={lesson.status === 'COMPLETED'}>Отметить проведённым</button>
      </div>
    </Modal>
  );
}
