import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../store';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';

export function ChangePasswordPage() {
  const { t } = useT();
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const [err, setErr] = useState('');
  const refreshMe = useAuth((s) => s.refreshMe);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/auth/change-password', { oldPassword: oldP, newPassword: newP });
      await refreshMe();
      nav('/complete-profile');
    } catch (e: any) {
      setErr(e?.response?.data?.message || t('toast.error'));
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>{t('auth.changeTitle')}</h1>
        <p>{t('auth.changeSubtitle')}</p>
        <div className="field">
          <label>{t('auth.passwordTemp')}</label>
          <input className="input" type="password" value={oldP} onChange={(e) => setOld(e.target.value)} required />
        </div>
        <div className="field">
          <label>{t('auth.passwordNew')}</label>
          <input className="input" type="password" value={newP} onChange={(e) => setNew(e.target.value)} required minLength={6} />
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }}>{t('btn.save')}</button>
      </form>
    </div>
  );
}
