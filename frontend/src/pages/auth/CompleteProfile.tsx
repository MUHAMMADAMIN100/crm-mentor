import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../store';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';

export function CompleteProfilePage() {
  const { t } = useT();
  const { user, refreshMe } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: '',
    telegram: '',
    whatsapp: '',
    instagram: '',
    website: '',
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
    if (!form.email) return setErr(t('auth.errEmail'));
    if (!form.phone && !form.telegram) return setErr(t('auth.errContact'));
    try {
      await api.post('/auth/complete-profile', form);
      await refreshMe();
      if (user?.role === 'TEACHER') nav('/teacher');
      else if (user?.role === 'ADMIN') nav('/admin');
      else nav('/student');
    } catch (e: any) {
      setErr(e?.response?.data?.message || t('toast.error'));
    }
  }

  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="auth-shell">
      <form className="auth-card" style={{ maxWidth: 560 }} onSubmit={submit}>
        <h1>{t('auth.profileTitle')}</h1>
        <p>{t('auth.profileSubtitle')}</p>
        <div className="field"><label>{t('profile.fullName')}</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} required /></div>
        <div className="row">
          <div className="field"><label>{t('profile.email')} *</label><input className="input" type="email" value={form.email} onChange={(e) => up('email', e.target.value)} required /></div>
          <div className="field"><label>{t('profile.birthDate')}</label><input className="input" type="date" value={form.birthDate} onChange={(e) => up('birthDate', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('profile.phone')}</label><input className="input" value={form.phone} onChange={(e) => up('phone', e.target.value)} /></div>
          <div className="field"><label>{t('profile.telegram')}</label><input className="input" value={form.telegram} onChange={(e) => up('telegram', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('profile.whatsapp')}</label><input className="input" value={form.whatsapp} onChange={(e) => up('whatsapp', e.target.value)} /></div>
          <div className="field"><label>{t('profile.instagram')}</label><input className="input" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} /></div>
        </div>
        <div className="field"><label>{t('profile.website')}</label><input className="input" placeholder="https://…" value={form.website} onChange={(e) => up('website', e.target.value)} /></div>
        <div className="row">
          <div className="field"><label>{t('profile.gender')}</label>
            <select className="select" value={form.gender} onChange={(e) => up('gender', e.target.value)}>
              <option value="">—</option>
              <option value="MALE">{t('profile.male')}</option>
              <option value="FEMALE">{t('profile.female')}</option>
              <option value="OTHER">{t('profile.other')}</option>
            </select>
          </div>
          <div className="field"><label>{t('profile.city')}</label><input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>
        </div>
        <div className="field"><label>{t('profile.activity')}</label><input className="input" value={form.activity} onChange={(e) => up('activity', e.target.value)} /></div>
        {!isStudent && (
          <div className="field"><label>{t('profile.category')}</label><input className="input" value={form.category} onChange={(e) => up('category', e.target.value)} /></div>
        )}
        {isStudent && (
          <>
            <div className="field"><label>{t('profile.goal')}</label><input className="input" value={form.goal} onChange={(e) => up('goal', e.target.value)} /></div>
            <div className="field">
              <label>{t('profile.bio')}</label>
              <textarea
                className="textarea"
                value={form.bio}
                onChange={(e) => up('bio', e.target.value)}
                placeholder={t('profile.bioPlaceholder')}
              />
            </div>
          </>
        )}
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }}>{t('auth.continue')}</button>
      </form>
    </div>
  );
}
