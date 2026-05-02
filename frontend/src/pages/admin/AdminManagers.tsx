import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { api, mutateCache, invalidateApi } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge, SortHeader, Paginator } from '../../components/AdminUI';

export function AdminManagers() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-created');
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const url = `/admin/managers?${new URLSearchParams({
    ...(search ? { search } : {}),
    sort,
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data: response, loading, refetch } = useApi<any>(url);
  const list: any[] = Array.isArray(response) ? response : response?.items || [];
  const total: number = response?.total || 0;
  const { data: perms } = useApi<string[]>('/admin/managers/permissions');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  // search is server-side now, no further client filtering
  const filtered = list;

  async function archive(id: string) {
    const ok = await confirmDialog({ title: t('admin.managers.confirmArchive'), danger: true, okLabel: t('btn.archive') });
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${id}/archive`);
      invalidateApi('/admin/managers');
      refetch();
      toast.success(t('teachers.archived'));
    } catch {
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

      {loading && !response ? <SkeletonTable rows={5} cols={6} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <SortHeader field="name" label={t('profile.fullName')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th>{t('profile.login')}</th>
                <SortHeader field="role" label={t('admin.managers.role')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th>{t('admin.managers.permissions')}</th>
                <SortHeader field="activity" label={t('admin.teacher.lastLogin')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => <ManagerRow key={m.id} m={m} t={t} onEdit={() => { setEditing(m); setOpen(true); }} onArchive={() => archive(m.id)} />)}
              {filtered.length === 0 && <tr><td colSpan={6} className="empty">{t('admin.managers.empty')}</td></tr>}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}

      {open && <ManagerForm initial={editing} permissions={perms || []} onClose={() => setOpen(false)} onSaved={refetch} />}
    </Shell>
  );
}

function ManagerRow({ m, t, onEdit, onArchive }: any) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    if (open && !stats) {
      api.get(`/admin/managers/${m.id}/stats`).then((r) => setStats(r.data)).catch(() => {});
    }
  }, [open, stats, m.id]);
  return (
    <>
      <tr>
        <td>
          <button onClick={() => setOpen((v) => !v)} aria-label="expand"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginRight: 6, fontSize: 14 }}>
            {open ? '▾' : '▸'}
          </button>
          <span style={{ fontWeight: 500 }}>{m.fullName}</span>
          {m.email && <div className="muted" style={{ fontSize: 11, marginLeft: 22 }}>{m.email}</div>}
        </td>
        <td>{m.login}</td>
        <td>{m.adminLevel ? <StatusBadge status={m.adminLevel} /> : '—'}</td>
        <td className="muted" style={{ fontSize: 11 }}>{m.permissions ? m.permissions.split(',').slice(0, 4).join(', ') + (m.permissions.split(',').length > 4 ? '…' : '') : '—'}</td>
        <td className="muted" style={{ fontSize: 11 }}>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : '—'}</td>
        <td className="admin-row-actions">
          <button className="btn btn-sm" onClick={onEdit}>{t('btn.edit')}</button>
          <button className="btn btn-sm btn-ghost" onClick={onArchive}>{t('btn.archive')}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-2)', padding: 14 }}>
            {!stats ? <span className="muted" style={{ fontSize: 12 }}>{t('status.loading')}</span> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                <StatBlock label={t('admin.managers.statTotal')} value={stats.total} />
                <StatBlock label={t('admin.managers.statCreates')} value={stats.creates} />
                <StatBlock label={t('admin.managers.statEdits')} value={stats.edits} />
                <StatBlock label={t('admin.managers.statArchives')} value={stats.archives} />
                <StatBlock label={t('admin.managers.statSubs')} value={stats.subs} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatBlock({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{value ?? 0}</div>
    </div>
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
