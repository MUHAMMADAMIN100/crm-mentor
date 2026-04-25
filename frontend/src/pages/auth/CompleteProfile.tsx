import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../store';
import { useNavigate } from 'react-router-dom';

export function CompleteProfilePage() {
  const { user, refreshMe } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: '',
    telegram: '',
    birthDate: '',
    gender: '',
    city: '',
    activity: '',
    category: '',
    goal: '',
    bio: '',
  });
  const [err, setErr] = useState('');

  function up(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.email) return setErr('Email обязателен');
    if (!form.phone && !form.telegram) return setErr('Укажите телефон или Telegram');
    try {
      await api.post('/auth/complete-profile', form);
      await refreshMe();
      if (user?.role === 'TEACHER') nav('/teacher');
      else if (user?.role === 'ADMIN') nav('/admin');
      else nav('/student');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Ошибка');
    }
  }

  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="auth-shell">
      <form className="auth-card" style={{ maxWidth: 560 }} onSubmit={submit}>
        <h1>Анкета</h1>
        <p>Расскажите о себе для удобной работы на платформе.</p>
        <div className="field"><label>ФИО</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} required /></div>
        <div className="row">
          <div className="field"><label>Email *</label><input className="input" type="email" value={form.email} onChange={(e) => up('email', e.target.value)} required /></div>
          <div className="field"><label>Дата рождения</label><input className="input" type="date" value={form.birthDate} onChange={(e) => up('birthDate', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Телефон</label><input className="input" value={form.phone} onChange={(e) => up('phone', e.target.value)} /></div>
          <div className="field"><label>Telegram</label><input className="input" value={form.telegram} onChange={(e) => up('telegram', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Пол</label>
            <select className="select" value={form.gender} onChange={(e) => up('gender', e.target.value)}>
              <option value="">—</option><option value="MALE">Мужской</option><option value="FEMALE">Женский</option><option value="OTHER">Другое</option>
            </select>
          </div>
          <div className="field"><label>Город</label><input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>
        </div>
        <div className="field"><label>Деятельность</label><input className="input" value={form.activity} onChange={(e) => up('activity', e.target.value)} /></div>
        {!isStudent && (
          <div className="field"><label>Категория / предмет</label><input className="input" value={form.category} onChange={(e) => up('category', e.target.value)} /></div>
        )}
        {isStudent && (
          <>
            <div className="field"><label>Цель обучения</label><input className="input" value={form.goal} onChange={(e) => up('goal', e.target.value)} /></div>
            <div className="field">
              <label>Дополнительная информация</label>
              <textarea
                className="textarea"
                value={form.bio}
                onChange={(e) => up('bio', e.target.value)}
                placeholder="Расскажите о себе: хобби, интересы, предпочтения, темы, которые вам нравятся или не нравятся."
              />
            </div>
          </>
        )}
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }}>Сохранить и продолжить</button>
      </form>
    </div>
  );
}
