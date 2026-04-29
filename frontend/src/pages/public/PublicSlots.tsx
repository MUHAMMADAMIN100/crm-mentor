import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';

export function PublicSlots() {
  const { teacherId } = useParams();
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<any>(null);
  const [form, setForm] = useState({ name: '', contact: '' });
  const [done, setDone] = useState(false);
  const [booking, setBooking] = useState(false);

  function load() { api.get(`/public/teachers/${teacherId}/slots`).then((r) => setData(r.data)); }
  useEffect(load, [teacherId]);

  async function book() {
    if (!form.name.trim() || !form.contact.trim()) { toast.warning('Заполните имя и контакт'); return; }
    setBooking(true);
    try {
      await api.post(`/public/slots/${picked.publicSlug}/book`, form);
      toast.success('Вы записаны!');
      setDone(true);
      setPicked(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Не удалось записаться');
    } finally { setBooking(false); }
  }

  if (!data) return <div className="auth-shell"><Loading label="Загружаем расписание…" /></div>;

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <h1>Запись на консультацию</h1>
        <p>Учитель: <strong>{data.teacher.fullName}</strong></p>
        {done && <div className="badge badge-success" style={{ marginBottom: 12 }}>Вы записаны! Учитель свяжется с вами.</div>}
        {!picked ? (
          <>
            <h3>Свободные окна</h3>
            <div className="list" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {data.slots.map((s: any) => (
                <div key={s.id} className="list-item">
                  <div>{new Date(s.startAt).toLocaleString('ru-RU')} · {s.durationMin} мин</div>
                  <button className="btn btn-sm btn-primary" onClick={() => setPicked(s)}>Выбрать</button>
                </div>
              ))}
              {data.slots.length === 0 && <div className="empty">Нет свободных окон</div>}
            </div>
          </>
        ) : (
          <>
            <p>Выбрано: <strong>{new Date(picked.startAt).toLocaleString('ru-RU')}</strong></p>
            <div className="field"><label>Ваше имя</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Контакт (телефон/Telegram/email)</label><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPicked(null)}>Назад</button>
              <button className="btn btn-primary" onClick={book} disabled={!form.name || !form.contact || booking}>{booking ? 'Записываем…' : 'Записаться'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
