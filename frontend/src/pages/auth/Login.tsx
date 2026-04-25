import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store';

export function LoginPage() {
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
      setErr(e?.response?.data?.message || 'Ошибка входа');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Miz</h1>
        <p>Войдите в свой аккаунт</p>
        <div className="field">
          <label>Логин</label>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Демо: admin/admin123, teacher/teacher123, student/student123
        </div>
      </form>
    </div>
  );
}
