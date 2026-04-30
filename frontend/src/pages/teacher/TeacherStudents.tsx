import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';

export function TeacherStudents() {
  const { data: list, loading, refetch } = useApi<any[]>('/students');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', login: '', password: '', individualPrice: 0 });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.fullName.trim() || !form.login.trim() || !form.password.trim()) {
      toast.warning('Заполните ФИО, логин и пароль');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post('/students', form);
      // Append optimistically so the new row is visible immediately
      mutateCache<any[]>('/students', undefined, (prev) => {
        const item = {
          id: r.data?.studentProfile?.id || `tmp-${Date.now()}`,
          balance: 0,
          allowReschedule: false,
          individualPrice: form.individualPrice,
          user: { id: r.data?.id, fullName: form.fullName, login: form.login },
        };
        return prev ? [item, ...prev] : [item];
      });
      invalidateApi('/students');
      refetch();
      setOpen(false);
      setForm({ fullName: '', login: '', password: '', individualPrice: 0 });
      toast.success('Ученик создан');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Не удалось создать');
    } finally { setSaving(false); }
  }

  async function archive(id: string) {
    const ok = await confirmDialog({ title: 'Архивировать ученика?', body: 'Ученик не сможет войти, но данные сохранятся.', okLabel: 'Архивировать' });
    if (!ok) return;
    // Optimistic: drop from list immediately
    const prev = list || [];
    mutateCache<any[]>('/students', undefined, (cur) => (cur || []).filter((s) => s.id !== id));
    try {
      await api.patch(`/students/${id}/archive`);
      invalidateApi('/students');
      toast.success('Архивирован');
    } catch {
      // Rollback
      mutateCache<any[]>('/students', undefined, () => prev);
      toast.error('Не удалось');
    }
  }

  return (
    <Shell title="Ученики">
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Добавить ученика</button>
      </div>

      {loading && !list ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ФИО</th><th>Логин</th><th>Баланс</th><th>Перенос</th><th></th></tr></thead>
            <tbody>
              {(list || []).map((s) => (
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
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">Нет учеников</td></tr>}
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
