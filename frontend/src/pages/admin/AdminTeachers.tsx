import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

export function AdminTeachers() {
  const { t } = useT();
  const { data: list, loading, refetch } = useApi<any[]>('/admin/teachers');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', login: '', password: '' });
  const [subOpen, setSubOpen] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function create(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    try {
      const r = await api.post('/admin/teachers', form);
      mutateCache<any[]>('/admin/teachers', undefined, (prev) => prev ? [r.data, ...prev] : [r.data]);
      invalidateApi('/admin/teachers');
      setOpen(false); setForm({ fullName: '', login: '', password: '' });
      toast.success(t('teachers.created'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('toast.notCreated'));
    }
    finally { setSaving(false); }
  }

  async function archive(id: string, archived: boolean) {
    const prev = list || [];
    mutateCache<any[]>('/admin/teachers', undefined, (cur) =>
      (cur || []).map((x: any) => x.id === id ? { ...x, archived: !archived } : x),
    );
    try {
      if (archived) await api.patch(`/admin/users/${id}/unarchive`);
      else await api.patch(`/admin/users/${id}/archive`);
      invalidateApi('/admin/teachers');
      toast.success(archived ? t('teachers.unarchived') : t('teachers.archived'));
    } catch {
      mutateCache<any[]>('/admin/teachers', undefined, () => prev);
      toast.error(t('toast.error'));
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: t('teachers.confirmDelete'),
      body: t('teachers.confirmDeleteBody'),
      danger: true,
      okLabel: t('btn.delete'),
    });
    if (!ok) return;
    const prev = list || [];
    mutateCache<any[]>('/admin/teachers', undefined, (cur) => (cur || []).filter((x: any) => x.id !== id));
    try {
      await api.delete(`/admin/users/${id}`);
      invalidateApi('/admin/teachers');
      toast.success(t('teachers.deleted'));
    } catch {
      mutateCache<any[]>('/admin/teachers', undefined, () => prev);
      toast.error(t('toast.notDeleted'));
    }
  }

  return (
    <Shell title={t('nav.teachers')}>
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>{t('btn.addTeacher')}</button>
      </div>

      {!list && loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('students.fullName')}</th><th>{t('profile.login')}</th><th>{t('teachers.subscription')}</th><th>{t('calendar.status')}</th><th></th></tr></thead>
            <tbody>
              {(list || []).map((tc: any) => (
                <tr key={tc.id}>
                  <td>{tc.fullName}</td>
                  <td>{tc.login}</td>
                  <td>{tc.teacherSubscription?.status || '—'} {tc.teacherSubscription?.endDate && <span className="muted"> · {t('course.untilDate')} {new Date(tc.teacherSubscription.endDate).toLocaleDateString()}</span>}</td>
                  <td>{tc.archived ? <span className="badge badge-past">{t('students.archive')}</span> : <span className="badge badge-success">{t('students.active')}</span>}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => setSubOpen(tc)}>{t('teachers.subscription')}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(tc.id, tc.archived)}>{tc.archived ? t('btn.unarchive') : t('btn.archive')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(tc.id)}>{t('btn.delete')}</button>
                  </td>
                </tr>
              ))}
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">{t('empty.noTeachers')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('btn.addTeacher')}
        footer={<>
          <button className="btn" onClick={() => setOpen(false)}>{t('btn.cancel')}</button>
          <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? t('status.creating') : t('btn.create')}</button>
        </>}>
        <form onSubmit={create}>
          <div className="field"><label>{t('profile.fullName')}</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="field"><label>{t('profile.login')}</label><input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required /></div>
          <div className="field"><label>{t('auth.passwordTemp')}</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
        </form>
      </Modal>

      {subOpen && <SubscriptionModal teacher={subOpen} onClose={() => { setSubOpen(null); refetch(); }} />}
    </Shell>
  );
}

function SubscriptionModal({ teacher, onClose }: { teacher: any; onClose: () => void }) {
  const { t } = useT();
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
    // Optimistic: patch the cached teachers list before round-trip
    mutateCache<any[]>('/admin/teachers', undefined, (cur) =>
      (cur || []).map((tt: any) => tt.id === teacher.id
        ? { ...tt, teacherSubscription: { ...(tt.teacherSubscription || {}), ...form } }
        : tt,
      ),
    );
    onClose();
    toast.success(t('teachers.subUpdated'));
    try {
      await api.patch(`/admin/teachers/${teacher.id}/subscription`, form);
      invalidateApi('/admin/teachers');
    } catch {
      invalidateApi('/admin/teachers');     // refetch real state on error
      toast.error(t('toast.notUpdated'));
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={`${t('teachers.subscriptionTitle')} ${teacher.fullName}`}
      footer={<>
        <button className="btn" onClick={onClose}>{t('btn.cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{t('btn.save')}</button>
      </>}>
      <div className="field"><label>{t('calendar.status')}</label>
        <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
          <option value="TRIAL">{t('teachers.subTrial')}</option>
          <option value="ACTIVE">{t('teachers.subActive')}</option>
          <option value="EXPIRED">{t('teachers.subExpired')}</option>
          <option value="BLOCKED">{t('teachers.subBlocked')}</option>
        </select>
      </div>
      <div className="field"><label>{t('calendar.type')}</label>
        <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
          <option value="MONTH">{t('teachers.month')}</option>
          <option value="YEAR">{t('teachers.year')}</option>
        </select>
      </div>
      <div className="row">
        <div className="field"><label>{t('teachers.start')}</label><input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div className="field"><label>{t('teachers.end')}</label><input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t('teachers.amount')}</label><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
    </Modal>
  );
}
