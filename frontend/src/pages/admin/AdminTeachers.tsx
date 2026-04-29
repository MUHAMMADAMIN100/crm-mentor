import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';

export function AdminTeachers() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', login: '', password: '' });
  const [subOpen, setSubOpen] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.get('/admin/teachers').then((r) => setList(r.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function create(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/teachers', form);
      setOpen(false); setForm({ fullName: '', login: '', password: '' });
      toast.success('Учитель создан');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Не удалось создать'); }
    finally { setSaving(false); }
  }

  async function archive(id: string, archived: boolean) {
    try {
      if (archived) await api.patch(`/admin/users/${id}/unarchive`);
      else await api.patch(`/admin/users/${id}/archive`);
      toast.success(archived ? 'Восстановлен' : 'Архивирован');
      load();
    } catch { toast.error('Не удалось'); }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Удалить учителя?',
      body: 'Аккаунт и все связанные данные будут удалены навсегда.',
      danger: true,
      okLabel: 'Удалить',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('Удалён');
      load();
    } catch { toast.error('Не удалось удалить'); }
  }

  return (
    <Shell title="Учителя">
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Создать учителя</button>
      </div>

      {loading && list.length === 0 ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ФИО</th><th>Логин</th><th>Подписка</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>{t.fullName}</td>
                  <td>{t.login}</td>
                  <td>{t.teacherSubscription?.status || '—'} {t.teacherSubscription?.endDate && <span className="muted"> · до {new Date(t.teacherSubscription.endDate).toLocaleDateString('ru-RU')}</span>}</td>
                  <td>{t.archived ? <span className="badge badge-past">архив</span> : <span className="badge badge-success">активен</span>}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => setSubOpen(t)}>Подписка</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(t.id, t.archived)}>{t.archived ? 'Восст.' : 'Архив'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="empty">Нет учителей</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Создать учителя"
        footer={<>
          <button className="btn" onClick={() => setOpen(false)}>Отмена</button>
          <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Создаём…' : 'Создать'}</button>
        </>}>
        <form onSubmit={create}>
          <div className="field"><label>ФИО</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="field"><label>Логин</label><input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required /></div>
          <div className="field"><label>Временный пароль</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
        </form>
      </Modal>

      {subOpen && <SubscriptionModal teacher={subOpen} onClose={() => { setSubOpen(null); load(); }} />}
    </Shell>
  );
}

function SubscriptionModal({ teacher, onClose }: { teacher: any; onClose: () => void }) {
  const s = teacher.teacherSubscription || {};
  const [form, setForm] = useState({
    status: s.status || 'TRIAL',
    type: s.type || 'MONTH',
    startDate: s.startDate ? s.startDate.slice(0, 10) : '',
    endDate: s.endDate ? s.endDate.slice(0, 10) : '',
    amount: s.amount || 0,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/teachers/${teacher.id}/subscription`, form);
      toast.success('Подписка обновлена');
      onClose();
    } catch { toast.error('Не удалось обновить'); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Подписка: ${teacher.fullName}`}
      footer={<>
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Сохранить</button>
      </>}>
      <div className="field"><label>Статус</label>
        <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
          <option value="TRIAL">Пробный период</option>
          <option value="ACTIVE">Активная</option>
          <option value="EXPIRED">Закончилась</option>
          <option value="BLOCKED">Заблокирована</option>
        </select>
      </div>
      <div className="field"><label>Тип</label>
        <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
          <option value="MONTH">Месяц</option>
          <option value="YEAR">Год</option>
        </select>
      </div>
      <div className="row">
        <div className="field"><label>Начало</label><input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div className="field"><label>Окончание</label><input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
      </div>
      <div className="field"><label>Сумма</label><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
    </Modal>
  );
}
