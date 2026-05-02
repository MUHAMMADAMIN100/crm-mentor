import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api, invalidateApi } from '../../api';
import { useApi } from '../../hooks';
import { SkeletonTable } from '../../components/Skeleton';
import { toast } from '../../store';
import { useT } from '../../i18n';
import { StatusBadge, BulkBar, SortHeader, Paginator } from '../../components/AdminUI';
import { ArchiveReasonModal } from '../../components/ArchiveReasonModal';
import { ImportModal } from '../../components/ImportModal';

export function AdminStudents() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState('all');
  const [activity, setActivity] = useState('any');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('-created');
  const [teacherId, setTeacherId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const url = `/admin/students?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(archived !== 'all' ? { archived } : {}),
    ...(activity !== 'any' ? { activity } : {}),
    ...(tag ? { tag } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(sort ? { sort } : {}),
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data: response, loading, refetch } = useApi<any>(url);
  const list: any[] = response?.items || [];
  const total: number = response?.total || 0;
  const { data: teachers } = useApi<any>('/admin/teachers');
  const teachersList: any[] = Array.isArray(teachers) ? teachers : (teachers as any)?.items || [];
  const { data: groupsData } = useApi<any[]>('/admin/groups');
  const groupsList: any[] = groupsData || [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importTeacherId, setImportTeacherId] = useState('');
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
      invalidateApi('/admin/students');
      refetch();
      toast.success(t('students.archived'));
    } catch { toast.error(t('toast.error')); }
  }
  async function unarchive(id: string) {
    try {
      await api.patch(`/admin/users/${id}/unarchive`);
      invalidateApi('/admin/students');
      refetch();
      toast.success(t('students.unarchived'));
    } catch { toast.error(t('toast.error')); }
  }
  async function deleteOne(id: string, reason: string) {
    setDeleteTarget(null);
    try {
      await api.delete(`/admin/users/${id}?reason=${encodeURIComponent(reason)}`);
      invalidateApi('/admin/students');
      refetch();
      toast.success(t('students.deleted'));
    } catch (e: any) { toast.error(e?.response?.data?.message || t('toast.notDeleted')); }
  }
  async function bulkArchive(reason: string) {
    setBulkArchiveOpen(false);
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      await api.post('/admin/users/bulk-archive', { ids, reason });
      invalidateApi('/admin/students');
      refetch();
      toast.success(`${t('admin.bulk.archived')}: ${ids.length}`);
    } catch { toast.error(t('toast.error')); }
  }

  function rowsForExport() {
    if (!list) return [];
    const items = selected.size > 0 ? list.filter((u: any) => selected.has(u.id)) : list;
    return items.map((u: any) => ({
      ФИО: u.fullName || '',
      Логин: u.login || '',
      Email: u.email || '',
      Телефон: u.phone || '',
      Учитель: u.studentProfile?.teacher?.fullName || '',
      Теги: u.tags || '',
      Создан: new Date(u.createdAt).toLocaleDateString(),
    }));
  }
  function exportSelected() {
    const rows = rowsForExport();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = '﻿' + [headers, ...rows.map((r: any) => headers.map((h) => r[h]))]
      .map((r: any[]) => r.map((c) => /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miz-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function exportXlsx() {
    const rows = rowsForExport();
    if (rows.length === 0) return;
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    xlsx.writeFile(wb, `miz-students-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const sortedList = list;
  const allSelected = list.length > 0 && selected.size === list.length;

  return (
    <Shell title={t('nav.students')}>
      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.fin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={archived} onChange={(e) => setArchived(e.target.value)}>
          <option value="all">{t('admin.filter.all')}</option>
          <option value="active">{t('students.active')}</option>
          <option value="archived">{t('students.archive')}</option>
        </select>
        <select className="select" value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="any">{t('admin.filter.activityAny')}</option>
          <option value="7d">{t('admin.filter.activity7d')}</option>
          <option value="30d">{t('admin.filter.activity30d')}</option>
          <option value="inactive7d">{t('admin.filter.inactive7d')}</option>
        </select>
        <select className="select" value={tag} onChange={(e) => { setTag(e.target.value); setOffset(0); }}>
          <option value="">{t('admin.filter.tagAny')}</option>
          <option value="vip">#vip</option>
          <option value="new">#new</option>
          <option value="inactive">#inactive</option>
          <option value="problem">#problem</option>
          <option value="champion">#champion</option>
        </select>
        <select className="select" value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setOffset(0); }}>
          <option value="">{t('admin.filter.teacherAny')}</option>
          {teachersList.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.fullName}</option>)}
        </select>
        <select className="select" value={groupId} onChange={(e) => { setGroupId(e.target.value); setOffset(0); }}>
          <option value="">{t('admin.filter.groupAny')}</option>
          {groupsList.map((g: any) => <option key={g.id} value={g.id}>{g.name}{g.teacher ? ` · ${g.teacher.fullName}` : ''}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={exportSelected}>⬇ CSV</button>
        <button className="btn" onClick={exportXlsx}>⬇ XLSX</button>
        <button className="btn" onClick={() => setImportOpen(true)}>⬆ {t('admin.import.import')}</button>
      </div>

      {!list && loading ? <SkeletonTable rows={6} cols={6} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th className="row-check"><input type="checkbox" checked={!!allSelected} onChange={toggleAll} /></th>
                <SortHeader field="name" label={t('students.fullName')} sort={sort} onSort={setSort} />
                <th>{t('profile.login')}</th>
                <th>{t('nav.teachers')}</th>
                <SortHeader field="activity" label={t('admin.teacher.lastLogin')} sort={sort} onSort={setSort} />
                <th>{t('calendar.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((s: any) => {
                const tags = (s.tags || '').split(',').filter(Boolean);
                return (
                  <tr key={s.id}>
                    <td className="row-check">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td>
                      <Link to={`/admin/students/${s.id}`} style={{ fontWeight: 500 }}>{s.fullName}</Link>
                      {tags.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {tags.map((t: string) => <span key={t} className="status-badge status-primary" style={{ fontSize: 9, padding: '1px 6px' }}>#{t}</span>)}
                        </div>
                      )}
                    </td>
                    <td>{s.login}</td>
                    <td>
                      {s.studentProfile?.teacher
                        ? <Link to={`/admin/teachers/${s.studentProfile.teacher.id}`}>{s.studentProfile.teacher.fullName}</Link>
                        : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : '—'}</td>
                    <td>{s.archived ? <StatusBadge status="ARCHIVED" /> : <StatusBadge status="ACTIVE" label={t('students.active')} />}</td>
                    <td className="admin-row-actions">
                      <Link className="btn btn-sm" to={`/admin/students/${s.id}`}>{t('btn.open')}</Link>
                      {s.archived
                        ? <button className="btn btn-sm btn-ghost" onClick={() => unarchive(s.id)}>{t('btn.unarchive')}</button>
                        : <button className="btn btn-sm btn-ghost" onClick={() => setArchiveTarget(s)}>{t('btn.archive')}</button>}
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(s)}>{t('btn.delete')}</button>
                    </td>
                  </tr>
                );
              })}
              {sortedList.length === 0 && <tr><td colSpan={7} className="empty">{t('empty.noFound')}</td></tr>}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}

      <ArchiveReasonModal
        open={!!archiveTarget}
        danger
        title={t('students.confirmArchive')}
        body={archiveTarget ? `${archiveTarget.fullName} (${archiveTarget.login})` : ''}
        okLabel={t('btn.archive')}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={(reason) => archiveTarget && archiveOne(archiveTarget.id, reason)}
      />
      <ArchiveReasonModal
        open={!!deleteTarget}
        danger
        title={t('students.confirmDelete')}
        body={t('students.confirmDeleteBody')}
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

      <ImportModal
        open={importOpen}
        onClose={() => { setImportOpen(false); refetch(); }}
        title={t('admin.import.studentsTitle')}
        requiredFields={['fullName', 'login', 'password']}
        optionalFields={['email', 'phone', 'telegram', 'individualPrice']}
        extraPayload={
          <div className="field">
            <label>{t('admin.import.assignTeacher')}</label>
            <select className="select" value={importTeacherId} onChange={(e) => setImportTeacherId(e.target.value)}>
              <option value="">— {t('btn.choose')} —</option>
              {teachersList.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.fullName} ({tt.login})</option>)}
            </select>
          </div>
        }
        onImport={async (rows) => {
          if (!importTeacherId) {
            toast.warning(t('admin.import.selectTeacherFirst'));
            throw new Error('teacher missing');
          }
          const r = await api.post('/admin/students/bulk-import', { teacherId: importTeacherId, rows });
          invalidateApi('/admin/students');
          return r.data;
        }}
      />
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <button className="btn btn-danger" onClick={() => setBulkArchiveOpen(true)}>{t('btn.archive')}</button>
        <button className="btn" onClick={exportSelected}>⬇ CSV</button>
      </BulkBar>
    </Shell>
  );
}
