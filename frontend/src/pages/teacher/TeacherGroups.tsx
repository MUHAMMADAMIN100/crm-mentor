import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { api, invalidateApi } from '../../api';
import { useApi } from '../../hooks';
import { Modal } from '../../components/Modal';
import { SkeletonGrid } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

export function TeacherGroups() {
  const { t } = useT();
  const { data: list, loading, refetch } = useApi<any[]>('/groups');
  const { data: students } = useApi<any[]>('/students');
  const { data: courses } = useApi<any[]>('/courses');
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  async function removeGroup(id: string) {
    const ok = await confirmDialog({ title: t('groups.confirmDelete'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    try {
      await api.delete(`/groups/${id}`);
      invalidateApi('/groups');
      toast.success(t('groups.deleted'));
      refetch();
    } catch { toast.error(t('toast.notDeleted')); }
  }

  return (
    <Shell title={t('groups.title')}>
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('btn.createGroup')}</button>
      </div>
      {loading && !list ? <SkeletonGrid count={3} /> : (
        <div className="cards-grid groups-grid">
          {(list || []).map((g) => (
            <div className="card group-card" key={g.id}>
              <div className="group-header">
                <h3 style={{ margin: 0 }}>{g.name}</h3>
                <div className="group-meta muted">{g.course?.title || '—'} · {g.members.length} {t('groups.studentsLabel').replace(':', '')}</div>
              </div>
              <div className="group-members">
                {g.members.slice(0, 4).map((m: any) => (
                  <div key={m.id} className="group-member">
                    <span className="member-avatar">{(m.student.user.fullName || '?')[0]}</span>
                    <span className="member-name">{m.student.user.fullName}</span>
                  </div>
                ))}
                {g.members.length > 4 && <div className="group-member-more">+{g.members.length - 4}</div>}
                {g.members.length === 0 && <div className="muted" style={{ fontSize: 12 }}>—</div>}
              </div>
              <div className="group-actions">
                <button className="btn btn-sm" onClick={() => setEditing(g)}>{t('btn.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => removeGroup(g.id)}>{t('btn.delete')}</button>
              </div>
            </div>
          ))}
          {(!list || list.length === 0) && <div className="empty">{t('groups.empty')}</div>}
        </div>
      )}

      {creating && <GroupForm students={students || []} courses={courses || []} onClose={(saved) => { setCreating(false); if (saved) { invalidateApi('/groups'); refetch(); } }} />}
      {editing && <GroupForm initial={editing} students={students || []} courses={courses || []} onClose={(saved) => { setEditing(null); if (saved) { invalidateApi('/groups'); refetch(); } }} />}
    </Shell>
  );
}

function GroupForm({ initial, students, courses, onClose }: any) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name || '');
  const [courseId, setCourseId] = useState(initial?.courseId || '');
  const [members, setMembers] = useState<{ id: string; price: number }[]>(
    initial?.members?.map((m: any) => ({ id: m.studentId || m.student?.id, price: m.pricePerLesson || 0 })) || [],
  );
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    if (members.find((m) => m.id === id)) setMembers(members.filter((m) => m.id !== id));
    else setMembers([...members, { id, price: 0 }]);
  }
  async function save() {
    if (!name.trim()) { toast.warning(t('groups.fillName')); return; }
    if (members.length === 0) { toast.warning(t('groups.fillMembers')); return; }
    setSaving(true);
    try {
      const body = {
        name,
        courseId: courseId || null,
        members: members.map((m) => ({ studentProfileId: m.id, pricePerLesson: m.price })),
      };
      if (initial) {
        await api.patch(`/groups/${initial.id}`, body);
        toast.success(t('groups.updated'));
      } else {
        await api.post('/groups', body);
        toast.success(t('groups.created'));
      }
      onClose(true);
    } catch (e: any) { toast.error(e?.response?.data?.message || t('toast.notSaved')); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={() => onClose(false)} title={initial ? t('groups.editGroup') : t('groups.newGroup')} width={520}
      footer={<><button className="btn" onClick={() => onClose(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('status.saving') : (initial ? t('btn.save') : t('btn.create'))}</button></>}>
      <div className="field"><label>{t('groups.name')}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>{t('groups.course')}</label>
        <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">{t('groups.courseNone')}</option>
          {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div className="field"><label>{t('groups.members')}</label>
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
