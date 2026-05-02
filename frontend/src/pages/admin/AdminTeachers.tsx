import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api, invalidateApi } from '../../api';
import { useApi } from '../../hooks';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge, BulkBar, SortHeader, Paginator } from '../../components/AdminUI';
import { ArchiveReasonModal } from '../../components/ArchiveReasonModal';
import { ImportModal } from '../../components/ImportModal';

export function AdminTeachers() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState('all');
  const [status, setStatus] = useState('all');
  const [activity, setActivity] = useState('any');
  const [hasStudents, setHasStudents] = useState('any');
  const [hasCourses, setHasCourses] = useState('any');
  const [sort, setSort] = useState('-created');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const url = `/admin/teachers?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(archived !== 'all' ? { archived } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(activity !== 'any' ? { activity } : {}),
    ...(hasStudents !== 'any' ? { hasStudents } : {}),
    ...(hasCourses !== 'any' ? { hasCourses } : {}),
    ...(sort ? { sort } : {}),
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data: response, loading, refetch } = useApi<any>(url);
  const list: any[] = response?.items || [];
  const total: number = response?.total || 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [subOpen, setSubOpen] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  function toggleAll() {
    if (!list) return;
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((u: any) => u.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function archiveOne(id: string, reason: string) {
    setArchiveTarget(null);
    try {
      await api.patch(`/admin/users/${id}/archive`, { reason });
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(t('teachers.archived'));
    } catch { toast.error(t('toast.error')); }
  }
  async function unarchive(id: string) {
    try {
      await api.patch(`/admin/users/${id}/unarchive`);
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(t('teachers.unarchived'));
    } catch { toast.error(t('toast.error')); }
  }
  async function deleteOne(id: string, reason: string) {
    setDeleteTarget(null);
    try {
      await api.delete(`/admin/users/${id}?reason=${encodeURIComponent(reason)}`);
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(t('teachers.deleted'));
    } catch (e: any) { toast.error(e?.response?.data?.message || t('toast.notDeleted')); }
  }
  async function bulkArchive(reason: string) {
    setBulkArchiveOpen(false);
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      await api.post('/admin/users/bulk-archive', { ids, reason });
      invalidateApi('/admin/teachers');
      refetch();
      toast.success(`${t('admin.bulk.archived')}: ${ids.length}`);
    } catch { toast.error(t('toast.error')); }
  }

  function exportSelected() {
    if (!list) return;
    const items = selected.size > 0 ? list.filter((u: any) => selected.has(u.id)) : list;
    const rows: string[][] = [];
    rows.push(['ФИО', 'Логин', 'Email', 'Телефон', 'Telegram', 'Подписка', 'Окончание', 'Учеников', 'Курсов', 'Уроков', 'Создан']);
    items.forEach((u: any) => rows.push([
      u.fullName || '',
      u.login || '',
      u.email || '',
      u.phone || '',
      u.telegram || '',
      u.teacherSubscription?.status || '',
      u.teacherSubscription?.endDate ? new Date(u.teacherSubscription.endDate).toLocaleDateString() : '',
      String(u._count?.teacherStudents || 0),
      String(u._count?.teacherCourses || 0),
      String(u._count?.teacherLessons || 0),
      new Date(u.createdAt).toLocaleDateString(),
    ]));
    const csv = '﻿' + rows.map((r) => r.map((c) => /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miz-teachers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortedList = list;
  const allSelected = list.length > 0 && selected.size === list.length;

  return (
    <Shell title={t('nav.teachers')}>
      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.fin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={archived} onChange={(e) => setArchived(e.target.value)}>
          <option value="all">{t('admin.filter.all')}</option>
          <option value="active">{t('students.active')}</option>
          <option value="archived">{t('students.archive')}</option>
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('admin.sub.allStatuses')}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <select className="select" value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="any">{t('admin.filter.activityAny')}</option>
          <option value="7d">{t('admin.filter.activity7d')}</option>
          <option value="30d">{t('admin.filter.activity30d')}</option>
          <option value="inactive7d">{t('admin.filter.inactive7d')}</option>
        </select>
        <select className="select" value={hasStudents} onChange={(e) => setHasStudents(e.target.value)}>
          <option value="any">{t('admin.filter.hasStudentsAny')}</option>
          <option value="yes">{t('admin.filter.hasStudentsYes')}</option>
          <option value="no">{t('admin.filter.hasStudentsNo')}</option>
        </select>
        <select className="select" value={hasCourses} onChange={(e) => setHasCourses(e.target.value)}>
          <option value="any">{t('admin.filter.hasCoursesAny')}</option>
          <option value="yes">{t('admin.filter.hasCoursesYes')}</option>
          <option value="no">{t('admin.filter.hasCoursesNo')}</option>
        </select>
        <div className="spacer" />
        <button className="btn" onClick={exportSelected}>⬇ CSV</button>
        <button className="btn" onClick={() => setImportOpen(true)}>⬆ {t('admin.import.import')}</button>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>{t('btn.addTeacher')}</button>
      </div>

      {!list && loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th className="row-check">
                  <input type="checkbox" checked={!!allSelected} onChange={toggleAll} />
                </th>
                <SortHeader field="name" label={t('students.fullName')} sort={sort} onSort={setSort} />
                <th>{t('profile.login')}</th>
                <th>{t('teachers.subscription')}</th>
                <SortHeader field="students" label={t('admin.teacher.studentsList')} sort={sort} onSort={setSort} />
                <SortHeader field="courses" label={t('admin.teacher.coursesList')} sort={sort} onSort={setSort} />
                <SortHeader field="activity" label={t('admin.teacher.lastLogin')} sort={sort} onSort={setSort} />
                <th>{t('calendar.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((tc: any) => (
                <tr key={tc.id}>
                  <td className="row-check">
                    <input type="checkbox" checked={selected.has(tc.id)} onChange={() => toggleOne(tc.id)} />
                  </td>
                  <td>
                    <Link to={`/admin/teachers/${tc.id}`} style={{ fontWeight: 500 }}>{tc.fullName}</Link>
                    {tc.email && <div className="muted" style={{ fontSize: 11 }}>{tc.email}</div>}
                  </td>
                  <td>{tc.login}</td>
                  <td>
                    {tc.teacherSubscription ? <StatusBadge status={tc.teacherSubscription.status} /> : '—'}
                    {tc.teacherSubscription?.endDate && <div className="muted" style={{ fontSize: 11 }}>{t('course.untilDate')} {new Date(tc.teacherSubscription.endDate).toLocaleDateString()}</div>}
                  </td>
                  <td>{tc._count?.teacherStudents || 0}</td>
                  <td>{tc._count?.teacherCourses || 0}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{tc.lastLoginAt ? new Date(tc.lastLoginAt).toLocaleDateString() : '—'}</td>
                  <td>{tc.archived ? <StatusBadge status="ARCHIVED" /> : <StatusBadge status="ACTIVE" label={t('students.active')} />}</td>
                  <td className="admin-row-actions">
                    <Link className="btn btn-sm" to={`/admin/teachers/${tc.id}`}>{t('btn.open')}</Link>
                    <button className="btn btn-sm" onClick={() => setSubOpen(tc)}>{t('teachers.subscription')}</button>
                    {tc.archived
                      ? <button className="btn btn-sm btn-ghost" onClick={() => unarchive(tc.id)}>{t('btn.unarchive')}</button>
                      : <button className="btn btn-sm btn-ghost" onClick={() => setArchiveTarget(tc)}>{t('btn.archive')}</button>}
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(tc)}>{t('btn.delete')}</button>
                  </td>
                </tr>
              ))}
              {sortedList.length === 0 && <tr><td colSpan={9} className="empty">{t('empty.noFound')}</td></tr>}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}

      {createOpen && <CreateTeacherModal onClose={() => setCreateOpen(false)} onSaved={refetch} />}
      <ImportModal
        open={importOpen}
        onClose={() => { setImportOpen(false); refetch(); }}
        title={t('admin.import.teachersTitle')}
        requiredFields={['fullName', 'login', 'password']}
        optionalFields={['email', 'phone']}
        onImport={async (rows) => {
          const r = await api.post('/admin/teachers/bulk-import', { rows });
          invalidateApi('/admin/teachers');
          return r.data;
        }}
      />

      {subOpen && <SubscriptionModal teacher={subOpen} onClose={() => { setSubOpen(null); refetch(); }} />}

      <ArchiveReasonModal
        open={!!archiveTarget}
        danger
        title={t('admin.teacher.confirmArchive')}
        body={archiveTarget ? `${archiveTarget.fullName} (${archiveTarget.login})` : ''}
        okLabel={t('btn.archive')}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={(reason) => archiveTarget && archiveOne(archiveTarget.id, reason)}
      />
      <ArchiveReasonModal
        open={!!deleteTarget}
        danger
        title={t('teachers.confirmDelete')}
        body={t('teachers.confirmDeleteBody')}
        okLabel={t('btn.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(reason) => deleteTarget && deleteOne(deleteTarget.id, reason)}
      />
      <ArchiveReasonModal
        open={bulkArchiveOpen}
        danger
        title={t('admin.bulk.archiveTitle')}
        body={`${t('admin.bulk.archiveBody')}: ${selected.size}`}
        okLabel={t('btn.archive')}
        onCancel={() => setBulkArchiveOpen(false)}
        onConfirm={bulkArchive}
      />

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <button className="btn btn-danger" onClick={() => setBulkArchiveOpen(true)}>{t('btn.archive')}</button>
        <button className="btn" onClick={exportSelected}>⬇ CSV</button>
      </BulkBar>
    </Shell>
  );
}

function CreateTeacherModal({ onClose, onSaved }: any) {
  const { t } = useT();
  const [form, setForm] = useState({ fullName: '', login: '', password: '' });
  function save(e?: any) {
    e?.preventDefault();
    if (!form.fullName.trim() || !form.login.trim() || form.password.length < 6) {
      toast.warning(t('students.fillForm'));
      return;
    }
    onClose();
    api.post('/admin/teachers', form)
      .then(() => { toast.success(t('teachers.created')); invalidateApi('/admin/teachers'); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notCreated')));
  }
  return (
    <Modal open onClose={onClose} title={t('btn.addTeacher')}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.create')}</button></>}>
      <form onSubmit={save}>
        <div className="field"><label>{t('profile.fullName')}</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
        <div className="field"><label>{t('profile.login')}</label><input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required /></div>
        <div className="field"><label>{t('auth.passwordTemp')}</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
      </form>
    </Modal>
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
  function save() {
    onClose();
    toast.success(t('teachers.subUpdated'));
    api.patch(`/admin/teachers/${teacher.id}/subscription`, form)
      .then(() => invalidateApi('/admin/teachers'))
      .catch(() => { invalidateApi('/admin/teachers'); toast.error(t('toast.notUpdated')); });
  }
  return (
    <Modal open onClose={onClose} title={`${t('teachers.subscriptionTitle')} ${teacher.fullName}`}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="field"><label>{t('calendar.status')}</label>
        <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
          <option value="TRIAL">{t('teachers.subTrial')}</option>
          <option value="ACTIVE">{t('teachers.subActive')}</option>
          <option value="EXPIRED">{t('teachers.subExpired')}</option>
          <option value="BLOCKED">{t('teachers.subBlocked')}</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
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
