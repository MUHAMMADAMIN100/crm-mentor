import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store';
import { useT } from '../../i18n';

export function LoginPage() {
  const { t } = useT();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const doLogin = useAuth((s) => s.login);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await doLogin(login, password);
      if (u.mustChangePassword) nav('/change-password');
      else if (!u.profileCompleted) nav('/complete-profile');
      else if (u.role === 'ADMIN') nav('/admin');
      else if (u.role === 'TEACHER') nav('/teacher');
      else nav('/student');
    } catch (e: any) {
      setErr(e?.response?.data?.message || t('auth.errLogin'));
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>{t('auth.miz')}</h1>
        <p>{t('auth.login.title')}</p>
        <div className="field">
          <label>{t('auth.login.label')}</label>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>{t('auth.password')}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? t('auth.login.busy') : t('auth.login.btn')}
        </button>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          {t('auth.login.demo')}
        </div>
      </form>
    </div>
  );
}
