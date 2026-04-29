import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonGrid } from '../../components/Skeleton';
import { toast } from '../../store';

export function TeacherGroups() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  function load() {
    setLoading(true);
    api.get('/groups').then((r) => setList(r.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); api.get('/students').then((r) => setStudents(r.data)); api.get('/courses').then((r) => setCourses(r.data)); }, []);

  return (
    <Shell title="Группы">
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Создать группу</button>
      </div>
      {loading && list.length === 0 ? <SkeletonGrid count={3} /> : (
        <div className="cards-grid">
          {list.map((g) => (
            <div className="card" key={g.id}>
              <h3>{g.name}</h3>
              <p className="muted">Курс: {g.course?.title || '—'}</p>
              <p>Учеников: {g.members.length}</p>
              <div className="list">
                {g.members.map((m: any) => (
                  <div key={m.id} className="list-item">
                    <div>{m.student.user.fullName}</div>
                    <div className="muted">{m.pricePerLesson} / урок</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="empty">Групп нет</div>}
        </div>
      )}

      {open && <CreateGroup students={students} courses={courses} onClose={() => { setOpen(false); load(); }} />}
    </Shell>
  );
}

function CreateGroup({ students, courses, onClose }: any) {
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [members, setMembers] = useState<{ id: string; price: number }[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    if (members.find((m) => m.id === id)) setMembers(members.filter((m) => m.id !== id));
    else setMembers([...members, { id, price: 0 }]);
  }
  async function create() {
    if (!name.trim()) { toast.warning('Введите название'); return; }
    if (members.length === 0) { toast.warning('Добавьте хотя бы одного ученика'); return; }
    setSaving(true);
    try {
      await api.post('/groups', {
        name, courseId: courseId || undefined,
        members: members.map((m) => ({ studentProfileId: m.id, pricePerLesson: m.price })),
      });
      toast.success('Группа создана');
      onClose();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Не удалось создать'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Новая группа" width={520}
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Создаём…' : 'Создать'}</button></>}>
      <div className="field"><label>Название</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Курс</label>
        <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">— без курса —</option>
          {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div className="field"><label>Ученики и цены</label>
        <div className="list" style={{ maxHeight: 250, overflowY: 'auto' }}>
          {students.map((s: any) => {
            const m = members.find((x) => x.id === s.id);
            return (
              <div key={s.id} className="list-item">
                <label className="flex"><input type="checkbox" checked={!!m} onChange={() => toggle(s.id)} /> {s.user.fullName}</label>
                {m && (
                  <input type="number" className="input" style={{ width: 100 }}
                    value={m.price}
                    onChange={(e) => setMembers(members.map((x) => x.id === s.id ? { ...x, price: +e.target.value } : x))} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
