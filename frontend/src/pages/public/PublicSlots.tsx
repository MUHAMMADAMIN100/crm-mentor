import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';
import { useT, useI18n, LANG_OPTIONS, Lang } from '../../i18n';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function PublicSlots() {
  const { t } = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const { teacherId } = useParams();
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<any>(null);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [month, setMonth] = useState(new Date());
  const [form, setForm] = useState({ name: '', contact: '' });
  const [done, setDone] = useState(false);
  const [booking, setBooking] = useState(false);

  function load() { api.get(`/public/teachers/${teacherId}/slots`).then((r) => setData(r.data)); }
  useEffect(load, [teacherId]);

  async function book() {
    if (!form.name.trim() || !form.contact.trim()) { toast.warning(t('public.fillAll')); return; }
    setBooking(true);
    // Optimistic: drop the picked slot from local list and show success right away
    const slug = picked.publicSlug;
    const id = picked.id;
    setData((d: any) => ({ ...d, slots: (d.slots || []).filter((s: any) => s.id !== id) }));
    setPicked(null);
    setPickedDay(null);
    setDone(true);
    toast.success(t('public.success'));
    try {
      await api.post(`/public/slots/${slug}/book`, form);
      load();    // background refresh for accurate state
    } catch (e: any) {
      load();
      setDone(false);
      toast.error(e?.response?.data?.message || t('public.errBook'));
    } finally { setBooking(false); }
  }

  // Build calendar cells
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const days: { date: Date; outside: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(first); d.setDate(first.getDate() - (startWeekday - i));
      days.push({ date: d, outside: true });
    }
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ date: new Date(month.getFullYear(), month.getMonth(), i), outside: false });
    }
    while (days.length % 7 !== 0) {
      const lastD = days[days.length - 1].date;
      const d = new Date(lastD); d.setDate(lastD.getDate() + 1);
      days.push({ date: d, outside: true });
    }
    return days;
  }, [month]);

  if (!data) return <div className="auth-shell"><Loading label={t('loader.schedule')} /></div>;

  const today = new Date();
  const slotsByDay = (date: Date) => data.slots.filter((s: any) => isSameDay(new Date(s.startAt), date));
  const slotsForPickedDay = pickedDay ? slotsByDay(pickedDay) : [];

  return (
    <div className="auth-shell" style={{ display: 'block', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary)' }}>{t('auth.miz')}</h1>
            <h2 style={{ fontSize: 18, margin: '6px 0 0' }}>{t('public.bookTitle')}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{t('public.teacher')}: <strong>{data.teacher.fullName}</strong></div>
          </div>
          <select className="select" style={{ maxWidth: 140 }} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANG_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
          </select>
        </div>

        {done && <div className="card" style={{ marginBottom: 16, color: 'var(--success)' }}>{t('public.bookedSuccess')}</div>}

        {!picked ? (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 12px' }}>{t('public.calendar')}</h3>
              <div className="cal-toolbar">
                <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                <div className="cal-month">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
                <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
                <button className="btn" onClick={() => setMonth(new Date())}>{t('btn.today')}</button>
              </div>
              <div className="calendar-grid" style={{ marginBottom: 4 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-soft)', padding: '4px 8px', fontWeight: 500 }}>
                    {t(`calendar.weekday.${i}` as any)}
                  </div>
                ))}
              </div>
              <div className="calendar-grid">
                {cells.map(({ date, outside }, idx) => {
                  const ds = slotsByDay(date);
                  const has = ds.length > 0;
                  const isToday = isSameDay(date, today);
                  return (
                    <div key={idx}
                      className={`cal-day ${outside ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => has && setPickedDay(date)}
                      style={{ cursor: has ? 'pointer' : 'default', opacity: outside ? 0.4 : has ? 1 : 0.6 }}>
                      <div className="num">{date.getDate()}</div>
                      {has && (
                        <div className="cal-event free" style={{ marginTop: 4 }}>
                          {ds.length} {t('calendar.freeShort')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('public.selectDay')}</div>
            </div>

            {pickedDay && (
              <div className="card">
                <h3 style={{ margin: '0 0 12px' }}>
                  {pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {slotsForPickedDay.map((s: any) => (
                    <div key={s.id} className="list-item">
                      <div>{new Date(s.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {s.durationMin} {t('misc.duration60')}</div>
                      <button className="btn btn-sm btn-primary" onClick={() => setPicked(s)}>{t('btn.choose')}</button>
                    </div>
                  ))}
                  {slotsForPickedDay.length === 0 && <div className="empty">{t('public.noSlotsDay')}</div>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <p>{t('public.selected')}: <strong>{new Date(picked.startAt).toLocaleString()}</strong></p>
            <div className="field"><label>{t('public.yourName')}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>{t('public.yourContact')}</label><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPicked(null)}>{t('btn.back')}</button>
              <button className="btn btn-primary" onClick={book} disabled={!form.name || !form.contact || booking}>{booking ? t('public.busy') : t('btn.book')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
