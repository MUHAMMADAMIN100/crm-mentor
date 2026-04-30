import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api, invalidateApi, mutateCache } from '../../api';
import { useApi } from '../../hooks';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

const emptyForm = {
  fullName: '', login: '', password: '', individualPrice: 0,
  email: '', phone: '', telegram: '', whatsapp: '', instagram: '', website: '',
  city: '', goal: '', bio: '',
};

export function TeacherStudents() {
  const { t } = useT();
  const { data: list, loading, refetch } = useApi<any[]>('/students');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.fullName.trim() || !form.login.trim() || !form.password.trim()) {
      toast.warning(t('students.fillForm'));
      return;
    }
    if (form.password.length < 6) { toast.warning(t('auth.errPasswordShort')); return; }
    setSaving(true);
    try {
      const r = await api.post('/students', form);
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
      setForm({ ...emptyForm });
      toast.success(t('students.created'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('toast.notCreated'));
    } finally { setSaving(false); }
  }

  async function archive(id: string) {
    const ok = await confirmDialog({ title: t('students.confirmArchive'), body: t('students.confirmArchiveBody'), okLabel: t('btn.archive') });
    if (!ok) return;
    const prev = list || [];
    mutateCache<any[]>('/students', undefined, (cur) => (cur || []).filter((s) => s.id !== id));
    try {
      await api.patch(`/students/${id}/archive`);
      invalidateApi('/students');
      toast.success(t('students.archived'));
    } catch {
      mutateCache<any[]>('/students', undefined, () => prev);
      toast.error(t('toast.error'));
    }
  }

  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  return (
    <Shell title={t('students.title')}>
      <div className="flex" style={{ marginBottom: 16 }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}>{t('btn.addStudent')}</button>
      </div>

      {loading && !list ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('students.fullName')}</th><th>{t('students.login')}</th><th>{t('students.balance')}</th><th>{t('students.allowReschedule')}</th><th></th></tr></thead>
            <tbody>
              {(list || []).map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/teacher/students/${s.id}`}>{s.user.fullName}</Link></td>
                  <td>{s.user.login}</td>
                  <td style={{ color: s.balance < 0 ? 'var(--danger)' : undefined }}>{s.balance}</td>
                  <td>{s.allowReschedule ? t('students.yes') : t('students.no')}</td>
                  <td className="flex" style={{ justifyContent: 'flex-end' }}>
                    <Link to={`/teacher/students/${s.id}`} className="btn btn-sm">{t('btn.open')}</Link>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id)}>{t('btn.archive')}</button>
                  </td>
                </tr>
              ))}
              {(!list || list.length === 0) && <tr><td colSpan={5} className="empty">{t('empty.noStudents')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('students.newStudent')} width={620}
        footer={<><button className="btn" onClick={() => setOpen(false)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? t('status.creating') : t('btn.create')}</button></>}>
        <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Учётная запись</h4>
        <div className="row">
          <div className="field"><label>{t('profile.fullName')} *</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} /></div>
          <div className="field"><label>{t('profile.login')} *</label><input className="input" value={form.login} onChange={(e) => up('login', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('auth.password')} *</label>
            <input className="input" type="text" value={form.password} onChange={(e) => up('password', e.target.value)} placeholder="мин. 6 символов" />
          </div>
          <div className="field"><label>{t('students.individualPrice')}</label><input type="number" className="input" value={form.individualPrice} onChange={(e) => up('individualPrice', +e.target.value)} /></div>
        </div>

        <h4 style={{ margin: '14px 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Контакты</h4>
        <div className="row">
          <div className="field"><label>{t('profile.email')}</label><input className="input" type="email" value={form.email} onChange={(e) => up('email', e.target.value)} /></div>
          <div className="field"><label>{t('profile.phone')}</label><input className="input" value={form.phone} onChange={(e) => up('phone', e.target.value)} placeholder="+7 999 …" /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('profile.telegram')}</label><input className="input" value={form.telegram} onChange={(e) => up('telegram', e.target.value)} placeholder="@username" /></div>
          <div className="field"><label>{t('profile.whatsapp')}</label><input className="input" value={form.whatsapp} onChange={(e) => up('whatsapp', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('profile.instagram')}</label><input className="input" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} placeholder="@username" /></div>
          <div className="field"><label>{t('profile.website')}</label><input className="input" value={form.website} onChange={(e) => up('website', e.target.value)} placeholder="https://…" /></div>
        </div>
        <div className="field"><label>{t('profile.city')}</label><input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>

        <h4 style={{ margin: '14px 0 8px', fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Доп. информация</h4>
        <div className="field"><label>{t('profile.goal')}</label><input className="input" value={form.goal} onChange={(e) => up('goal', e.target.value)} /></div>
        <div className="field"><label>{t('profile.bio')}</label><textarea className="textarea" value={form.bio} onChange={(e) => up('bio', e.target.value)} placeholder={t('profile.bioPlaceholder')} /></div>
      </Modal>
    </Shell>
  );
}
