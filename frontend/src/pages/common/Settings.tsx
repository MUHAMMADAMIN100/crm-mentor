import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function SettingsPage() {
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/auth/change-password', { oldPassword: oldP, newPassword: newP });
      setMsg('Пароль обновлён');
      setOld(''); setNew('');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Ошибка');
    }
  }

  return (
    <Shell title="Настройки">
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>Смена пароля</h3>
        <form onSubmit={submit}>
          <div className="field"><label>Текущий пароль</label><input className="input" type="password" value={oldP} onChange={(e) => setOld(e.target.value)} required /></div>
          <div className="field"><label>Новый пароль</label><input className="input" type="password" value={newP} onChange={(e) => setNew(e.target.value)} required minLength={6} /></div>
          {msg && <div style={{ fontSize: 13, marginBottom: 8 }}>{msg}</div>}
          <button className="btn btn-primary">Сохранить</button>
        </form>
      </div>
    </Shell>
  );
}
