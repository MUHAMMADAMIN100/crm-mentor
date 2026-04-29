import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';

export function TeacherStudents() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', login: '', password: '', individualPrice: 0 });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.get('/students').then((r) => setList(r.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function create() {
    if (!form.fullName.trim() || !form.login.trim() || !form.password.trim()) {
      toast.warning('Заполните ФИО, логин и пароль');
      return;
    }
    setSaving(true);
    try {
      await api.post('/students', form);
      setOpen(false);
      setForm({ fullName: '', login: '', password: '', individualPrice: 0 });
      toast.success('Ученик создан');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Не удалось создать'); }
    finally { setSaving(false); }
  }

  async function archive(id: string) {
    const ok = await confirmDialog({ title: 'Архивировать ученика?', body: 'Ученик не сможет войти, но данные сохранятся.', okLabel: 'Архивировать' });
    if (!ok) return;
    try {
      await api.patch(`/students/${id}/archive`);
      toast.success('Архивирован');
      load();
    } catch { toast.error('Не удалось'); }
  }

  return (
    <Shell title="Ученики">
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Добавить ученика</button>
      </div>

      {loading && list.length === 0 ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ФИО</th><th>Логин</th><th>Баланс</th><th>Перенос</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/teacher/students/${s.id}`}>{s.user.fullName}</Link></td>
                  <td>{s.user.login}</td>
                  <td style={{ color: s.balance < 0 ? 'var(--danger)' : undefined }}>{s.balance}</td>
                  <td>{s.allowReschedule ? 'Да' : 'Нет'}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end' }}>
                    <Link to={`/teacher/students/${s.id}`} className="btn btn-sm">Открыть</Link>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id)}>Архив</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="empty">Нет учеников</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новый ученик"
        footer={<><button className="btn" onClick={() => setOpen(false)}>Отмена</button><button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Создаём…' : 'Создать'}</button></>}>
        <div className="field"><label>ФИО</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div className="field"><label>Логин</label><input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></div>
        <div className="field"><label>Временный пароль</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="field"><label>Стоимость занятия</label><input type="number" className="input" value={form.individualPrice} onChange={(e) => setForm({ ...form, individualPrice: +e.target.value })} /></div>
      </Modal>
    </Shell>
  );
}
