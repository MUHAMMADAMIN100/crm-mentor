import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { toast } from '../../store';

export function SettingsPage() {
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/change-password', { oldPassword: oldP, newPassword: newP });
      toast.success('Пароль обновлён');
      setOld(''); setNew('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ошибка смены пароля');
    } finally { setSaving(false); }
  }

  return (
    <Shell title="Настройки">
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>Смена пароля</h3>
        <form onSubmit={submit}>
          <div className="field"><label>Текущий пароль</label><input className="input" type="password" value={oldP} onChange={(e) => setOld(e.target.value)} required /></div>
          <div className="field"><label>Новый пароль</label><input className="input" type="password" value={newP} onChange={(e) => setNew(e.target.value)} required minLength={6} /></div>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
        </form>
      </div>
    </Shell>
  );
}
