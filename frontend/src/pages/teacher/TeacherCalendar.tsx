import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { CalEvent, MonthCalendar } from '../../components/Calendar';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast, confirmDialog } from '../../store';

type Action = 'lesson' | 'free' | 'event' | null;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function TeacherCalendar() {
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
      .catch(() => toast.error('Не удалось загрузить календарь'))
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
        title: lessonTitle(l, students, groups),
        startAt: l.startAt,
        variant: l.status === 'COMPLETED' ? 'completed' : (new Date(l.startAt) < now ? 'past' : 'lesson'),
      })),
      ...data.freeSlots.map((s: any) => ({ id: 'F' + s.id, title: 'Свободно', startAt: s.startAt, variant: 'free' as const })),
      ...data.events.map((e: any) => ({ id: 'E' + e.id, title: e.title, startAt: e.startAt, variant: 'event' as const })),
    ];
  }, [data, students, groups]);

  function goToday() { setMonth(new Date()); }

  async function copyPublicLink() {
    try {
      const me = await api.get('/auth/me');
      const url = `${location.origin}/book/${me.data.id}`;
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована в буфер обмена', 'Готово');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  }

  return (
    <Shell title="Календарь">
      <div className="cal-toolbar">
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Предыдущий месяц">‹</button>
        <div className="cal-month">{month.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</div>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Следующий месяц">›</button>
        <button className="btn" onClick={goToday}>Сегодня</button>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={copyPublicLink}>📎 Скопировать ссылку записи</button>
      </div>

      {loading && events.length === 0 ? (
        <div className="card"><Loading label="Загружаем календарь…" /></div>
      ) : (
        <MonthCalendar
          month={month}
          events={events}
          onDayClick={(d) => { setPickedDay(d); setAction(null); }}
          onEventClick={(ev) => setPickedEvent(ev)}
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
          studentName={pickedEvent.title}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
      {pickedEvent && pickedEvent.id.startsWith('F') && (
        <FreeSlotActions
          slot={data.freeSlots.find((s: any) => 'F' + s.id === pickedEvent.id)}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
      {pickedEvent && pickedEvent.id.startsWith('E') && (
        <EventActions
          ev={data.events.find((e: any) => 'E' + e.id === pickedEvent.id)}
          onClose={(refresh) => { setPickedEvent(null); if (refresh) load(); }}
        />
      )}
    </Shell>
  );
}

function lessonTitle(l: any, students: any[], groups: any[]) {
  if (l.type === 'INDIVIDUAL') {
    const s = students.find((x) => x.id === l.studentProfileId);
    return s?.user?.fullName || 'Урок';
  }
  const g = groups.find((x) => x.id === l.groupId);
  return g?.name || 'Группа';
}

function DayDetail({ day, events, onClose, onCreate, onEventClick }: any) {
  const sorted = [...events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  return (
    <Modal open onClose={onClose} title={day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} width={520}>
      {sorted.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-soft)', fontWeight: 500 }}>СОБЫТИЯ ДНЯ</h4>
          <div className="day-detail-list" style={{ marginBottom: 16 }}>
            {sorted.map((e: any) => (
              <div key={e.id} className={`day-detail-item ${e.variant}`} onClick={() => onEventClick(e)}>
                <div className="vbar" />
                <div className="time">{new Date(e.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{labelForVariant(e.variant)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-soft)', fontWeight: 500 }}>ДОБАВИТЬ</h4>
      <div className="flex-col">
        <button className="btn btn-primary" onClick={() => onCreate('lesson')}>+ Урок</button>
        <button className="btn" onClick={() => onCreate('free')}>+ Свободное окно</button>
        <button className="btn" onClick={() => onCreate('event')}>+ Личное дело</button>
      </div>
    </Modal>
  );
}

function labelForVariant(v: string) {
  return ({ lesson: 'Урок', completed: 'Проведён', past: 'Прошёл', free: 'Свободное окно', event: 'Личное дело' } as any)[v] || v;
}

function LessonForm({ day, students, groups, onClose }: any) {
  const [form, setForm] = useState({
    type: 'INDIVIDUAL', studentProfileId: '', groupId: '',
    time: '12:00', durationMin: 60, link: '', comment: '',
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (form.type === 'INDIVIDUAL' && !form.studentProfileId) { toast.warning('Выберите ученика'); return; }
    if (form.type === 'GROUP' && !form.groupId) { toast.warning('Выберите группу'); return; }
    const [hh, mm] = form.time.split(':').map(Number);
    const dt = new Date(day);
    dt.setHours(hh, mm, 0, 0);
    setSaving(true);
    try {
      await api.post('/calendar/lessons', {
        type: form.type,
        studentProfileId: form.type === 'INDIVIDUAL' ? form.studentProfileId : null,
        groupId: form.type === 'GROUP' ? form.groupId : null,
        startAt: dt.toISOString(),
        durationMin: form.durationMin,
        link: form.link, comment: form.comment,
      });
      toast.success('Урок создан');
      onClose(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Не удалось создать урок');
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title="Новый урок"
      footer={<><button className="btn" onClick={() => onClose(false)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Создать'}</button></>}>
      <div className="field"><label>Тип</label>
        <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="INDIVIDUAL">Индивидуальный</option><option value="GROUP">Групповой</option>
        </select>
      </div>
      {form.type === 'INDIVIDUAL' ? (
        <div className="field"><label>Ученик</label>
          <select className="select" value={form.studentProfileId} onChange={(e) => setForm({ ...form, studentProfileId: e.target.value })}>
            <option value="">— выбрать —</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.fullName}</option>)}
          </select>
        </div>
      ) : (
        <div className="field"><label>Группа</label>
          <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
            <option value="">— выбрать —</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}
      <div className="row">
        <div className="field"><label>Время</label><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
        <div className="field"><label>Длительность, мин</label><input className="input" type="number" min={15} max={480} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: +e.target.value })} /></div>
      </div>
      <div className="field"><label>Ссылка (Zoom/Meet)</label><input className="input" placeholder="https://…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
      <div className="field"><label>Комментарий</label><textarea className="textarea" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
    </Modal>
  );
}

function FreeSlotForm({ day, onClose }: any) {
  const [time, setTime] = useState('12:00');
  const [dur, setDur] = useState(60);
  const [saving, setSaving] = useState(false);
  async function save() {
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    setSaving(true);
    try {
      await api.post('/calendar/free-slots', { startAt: dt.toISOString(), durationMin: dur });
      toast.success('Свободное окно создано');
      onClose(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Не удалось создать');
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title="Свободное окно"
      footer={<><button className="btn" onClick={() => onClose(false)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>Создать</button></>}>
      <div className="row">
        <div className="field"><label>Время</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="field"><label>Длительность, мин</label><input className="input" type="number" min={15} max={480} value={dur} onChange={(e) => setDur(+e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function EventForm({ day, onClose }: any) {
  const [form, setForm] = useState({ title: '', time: '12:00', reminder: false, description: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.title.trim()) { toast.warning('Введите название'); return; }
    const [hh, mm] = form.time.split(':').map(Number);
    const dt = new Date(day); dt.setHours(hh, mm, 0, 0);
    setSaving(true);
    try {
      await api.post('/calendar/events', { ...form, startAt: dt.toISOString() });
      toast.success('Личное дело добавлено');
      onClose(true);
    } catch { toast.error('Не удалось сохранить'); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title="Личное дело"
      footer={<><button className="btn" onClick={() => onClose(false)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>Создать</button></>}>
      <div className="field"><label>Название</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="field"><label>Время</label><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
      <div className="field"><label><input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} /> Напоминание</label></div>
      <div className="field"><label>Описание</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
    </Modal>
  );
}

function LessonActions({ lesson, studentName, onClose }: any) {
  if (!lesson) return null;
  async function complete() {
    try {
      await api.post(`/calendar/lessons/${lesson.id}/complete`);
      toast.success('Урок отмечен проведённым');
      onClose(true);
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Ошибка'); }
  }
  async function del() {
    const ok = await confirmDialog({ title: 'Удалить урок?', body: 'Действие нельзя отменить.', danger: true, okLabel: 'Удалить' });
    if (!ok) return;
    try {
      await api.delete(`/calendar/lessons/${lesson.id}`);
      toast.success('Урок удалён');
      onClose(true);
    } catch { toast.error('Не удалось удалить'); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={studentName || 'Урок'}>
      <p style={{ margin: 0 }}>{new Date(lesson.startAt).toLocaleString('ru-RU')} · {lesson.durationMin} мин</p>
      <p className="muted" style={{ marginTop: 6 }}>Статус: {lesson.status}</p>
      {lesson.link && <p>Ссылка: <a href={lesson.link} target="_blank" rel="noreferrer">{lesson.link}</a></p>}
      {lesson.comment && <p>{lesson.comment}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>Удалить</button>
        <button className="btn btn-primary" onClick={complete} disabled={lesson.status === 'COMPLETED'}>
          {lesson.status === 'COMPLETED' ? 'Уже проведён' : 'Отметить проведённым'}
        </button>
      </div>
    </Modal>
  );
}

function FreeSlotActions({ slot, onClose }: any) {
  if (!slot) return null;
  async function del() {
    const ok = await confirmDialog({ title: 'Удалить свободное окно?', danger: true, okLabel: 'Удалить' });
    if (!ok) return;
    try {
      await api.delete(`/calendar/free-slots/${slot.id}`);
      toast.success('Окно удалено');
      onClose(true);
    } catch { toast.error('Не удалось удалить'); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title="Свободное окно">
      <p>{new Date(slot.startAt).toLocaleString('ru-RU')} · {slot.durationMin} мин</p>
      {slot.takenName && <p className="muted">Забронировал: {slot.takenName}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>Удалить</button>
      </div>
    </Modal>
  );
}

function EventActions({ ev, onClose }: any) {
  if (!ev) return null;
  async function del() {
    const ok = await confirmDialog({ title: 'Удалить личное дело?', danger: true, okLabel: 'Удалить' });
    if (!ok) return;
    try {
      await api.delete(`/calendar/events/${ev.id}`);
      toast.success('Удалено');
      onClose(true);
    } catch { toast.error('Не удалось удалить'); }
  }
  return (
    <Modal open onClose={() => onClose(false)} title={ev.title}>
      <p>{new Date(ev.startAt).toLocaleString('ru-RU')}</p>
      {ev.description && <p>{ev.description}</p>}
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={del}>Удалить</button>
      </div>
    </Modal>
  );
}
