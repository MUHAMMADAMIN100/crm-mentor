import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonGrid } from '../../components/Skeleton';
import { toast } from '../../store';

export function TeacherCourses() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '', price: 0 });
  const [saving, setSaving] = useState(false);

  function load() { setLoading(true); api.get('/courses').then((r) => setList(r.data)).finally(() => setLoading(false)); }
  useEffect(load, []);

  async function create() {
    if (!form.title.trim()) { toast.warning('Введите название'); return; }
    setSaving(true);
    try {
      await api.post('/courses', form);
      setOpen(false); setForm({ title: '', description: '', category: '', price: 0 });
      toast.success('Курс создан');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Не удалось создать'); }
    finally { setSaving(false); }
  }
  return (
    <Shell title="Курсы">
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Создать курс</button>
      </div>
      {loading && list.length === 0 ? <SkeletonGrid count={3} /> : (
        <div className="cards-grid">
          {list.map((c) => (
            <Link key={c.id} to={`/teacher/courses/${c.id}`} className="card" style={{ display: 'block' }}>
              <h3>{c.title}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{c.category}</div>
              <p>{c.description}</p>
              <div className="flex">
                <span className="badge badge-neutral">{c.status}</span>
                <span className="muted" style={{ fontSize: 12 }}>{c._count?.modules} модулей · {c._count?.accesses} учеников</span>
              </div>
            </Link>
          ))}
          {list.length === 0 && <div className="empty">Нет курсов</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новый курс"
        footer={<><button className="btn" onClick={() => setOpen(false)}>Отмена</button><button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Создаём…' : 'Создать'}</button></>}>
        <div className="field"><label>Название</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></div>
        <div className="field"><label>Категория</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div className="field"><label>Описание</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Цена</label><input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
      </Modal>
    </Shell>
  );
}
