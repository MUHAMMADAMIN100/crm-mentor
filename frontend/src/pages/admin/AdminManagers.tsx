import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { api, mutateCache, invalidateApi } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge } from '../../components/AdminUI';

export function AdminManagers() {
  const { t } = useT();
  const { data: list, loading, refetch } = useApi<any[]>('/admin/managers');
  const { data: perms } = useApi<string[]>('/admin/managers/permissions');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');

  const filtered = (list || []).filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (m.fullName || '').toLowerCase().includes(q)
      || (m.login || '').toLowerCase().includes(q)
      || (m.email || '').toLowerCase().includes(q);
  });

  async function archive(id: string) {
    const ok = await confirmDialog({ title: t('admin.managers.confirmArchive'), danger: true, okLabel: t('btn.archive') });
    if (!ok) return;
    const prev = list || [];
    mutateCache<any[]>('/admin/managers', undefined, (cur) => (cur || []).filter((x) => x.id !== id));
    try {
      await api.patch(`/admin/users/${id}/archive`);
      invalidateApi('/admin/managers');
      toast.success(t('teachers.archived'));
    } catch {
      mutateCache<any[]>('/admin/managers', undefined, () => prev);
      toast.error(t('toast.error'));
    }
  }

  return (
    <Shell title={t('admin.managers.title')}>
      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.managers.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>{t('admin.managers.create')}</button>
      </div>

      {loading && !list ? <SkeletonTable rows={5} cols={6} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('profile.fullName')}</th>
                <th>{t('profile.login')}</th>
                <th>{t('admin.managers.role')}</th>
                <th>{t('admin.managers.permissions')}</th>
                <th>{t('admin.teacher.lastLogin')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.fullName}</div>
                    {m.email && <div className="muted" style={{ fontSize: 11 }}>{m.email}</div>}
                  </td>
                  <td>{m.login}</td>
                  <td>{m.adminLevel ? <StatusBadge status={m.adminLevel} /> : '—'}</td>
                  <td className="muted" style={{ fontSize: 11 }}>{m.permissions ? m.permissions.split(',').slice(0, 4).join(', ') + (m.permissions.split(',').length > 4 ? '…' : '') : '—'}</td>
                  <td className="muted" style={{ fontSize: 11 }}>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : '—'}</td>
                  <td className="admin-row-actions">
                    <button className="btn btn-sm" onClick={() => { setEditing(m); setOpen(true); }}>{t('btn.edit')}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => archive(m.id)}>{t('btn.archive')}</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="empty">{t('admin.managers.empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {open && <ManagerForm initial={editing} permissions={perms || []} onClose={() => setOpen(false)} onSaved={refetch} />}
    </Shell>
  );
}

function ManagerForm({ initial, permissions, onClose, onSaved }: any) {
  const { t } = useT();
  const isEdit = !!initial;
  const [form, setForm] = useState<any>({
    fullName: initial?.fullName || '',
    login: initial?.login || '',
    password: initial?.plainPassword || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    telegram: initial?.telegram || '',
    adminLevel: initial?.adminLevel || 'SUPPORT',
    permissions: initial?.permissions ? initial.permissions.split(',').filter(Boolean) : ['view'],
  });
  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function togglePerm(p: string) {
    setForm((f: any) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x: string) => x !== p) : [...f.permissions, p],
    }));
  }

  function save() {
    if (!form.fullName.trim() || !form.login.trim() || (!isEdit && !form.password.trim())) {
      toast.warning(t('students.fillForm'));
      return;
    }
    onClose();
    const payload: any = { ...form };
    if (isEdit && !payload.password) delete payload.password;
    const req = isEdit
      ? api.patch(`/admin/managers/${initial.id}`, payload)
      : api.post('/admin/managers', payload);
    req
      .then(() => { toast.success(isEdit ? t('btn.save') : t('admin.managers.created')); invalidateApi('/admin/managers'); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notSaved')));
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? t('admin.managers.editTitle') : t('admin.managers.createTitle')} width={760}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{isEdit ? t('btn.save') : t('btn.create')}</button></>}>
      <div className="modal-form-2col">
        <section>
          <h4 className="modal-section-title">{t('students.profile')}</h4>
          <div className="field"><label>{t('profile.fullName')} *</label><input className="input" value={form.fullName} onChange={(e) => up('fullName', e.target.value)} /></div>
          <div className="field"><label>{t('profile.login')} *</label><input className="input" value={form.login} onChange={(e) => up('login', e.target.value)} /></div>
          <div className="field"><label>{t('auth.password')} {isEdit ? `(${t('common.optional')})` : '*'}</label>
            <input className="input" type="text" value={form.password} onChange={(e) => up('password', e.target.value)} />
          </div>
          <div className="field"><label>{t('admin.managers.role')}</label>
            <select className="select" value={form.adminLevel} onChange={(e) => up('adminLevel', e.target.value)}>
              <option value="SUPER_ADMIN">Super admin</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPPORT">Support</option>
              <option value="SALES">Sales</option>
            </select>
          </div>
        </section>
        <section>
          <h4 className="modal-section-title">{t('admin.teacher.contacts')}</h4>
          <div className="field"><label>{t('profile.email')}</label><input className="input" value={form.email} onChange={(e) => up('email', e.target.value)} /></div>
          <div className="field"><label>{t('profile.phone')}</label><input className="input" value={form.phone} onChange={(e) => up('phone', e.target.value)} /></div>
          <div className="field"><label>{t('profile.telegram')}</label><input className="input" value={form.telegram} onChange={(e) => up('telegram', e.target.value)} /></div>

          <h4 className="modal-section-title" style={{ marginTop: 14 }}>{t('admin.managers.permissions')}</h4>
          <div className="manager-perm-grid">
            {(permissions || []).map((p: string) => (
              <label key={p}>
                <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                {p}
              </label>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
