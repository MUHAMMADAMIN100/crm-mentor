import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { api, invalidateApi } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast } from '../../store';
import { useT } from '../../i18n';
import { Kpi, StatusBadge, SortHeader, Paginator, BulkBar } from '../../components/AdminUI';

export function AdminSubscriptions() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [subType, setSubType] = useState('all');
  const [period, setPeriod] = useState('30d');
  const [sort, setSort] = useState('endDate');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const url = `/admin/finance?${new URLSearchParams({
    period,
    ...(search ? { search } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(subType !== 'all' ? { subType } : {}),
    sort,
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data, refetch } = useApi<any>(url);

  const subs = data?.subscriptions || [];
  const counts = data?.counts || {};
  const total = data?.total || 0;
  const sortedSubs = useMemo(() => subs, [subs]);

  const [extendTarget, setExtendTarget] = useState<any | null>(null);
  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkExtendOpen, setBulkExtendOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  function toggleAll() {
    if (selected.size === subs.length) setSelected(new Set());
    else setSelected(new Set(subs.map((s: any) => s.teacherId)));
  }
  function toggleOne(teacherId: string) {
    const next = new Set(selected);
    next.has(teacherId) ? next.delete(teacherId) : next.add(teacherId);
    setSelected(next);
  }

  return (
    <Shell title={t('admin.sub.title')}>
      {/* Status overview */}
      <div className="kpi-grid">
        <Kpi label={t('admin.sub.kpi.active')} value={counts.ACTIVE || 0} accent="success" />
        <Kpi label={t('admin.sub.kpi.trial')} value={counts.TRIAL || 0} accent="warning" />
        <Kpi label={t('admin.sub.kpi.expired')} value={counts.EXPIRED || 0} accent="danger" />
        <Kpi label={t('admin.sub.kpi.paused')} value={counts.PAUSED || 0} accent="muted" />
        <Kpi label={t('admin.sub.kpi.canceled')} value={counts.CANCELED || 0} accent="muted" />
        <Kpi label={t('admin.sub.kpi.blocked')} value={counts.BLOCKED || 0} accent="danger" />
      </div>

      <div className="admin-toolbar">
        <input className="input search" placeholder={t('admin.sub.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.sub.allStatuses')}</option>
          <option value="TRIAL">TRIAL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <select className="select" value={subType} onChange={(e) => { setSubType(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.fin.typeAny')}</option>
          <option value="MONTH">{t('teachers.month')}</option>
          <option value="YEAR">{t('teachers.year')}</option>
        </select>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="90d">90 дней</option>
        </select>
      </div>

      {!data ? <SkeletonTable rows={6} cols={8} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th className="row-check">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === subs.length} onChange={toggleAll} />
                </th>
                <th>{t('profile.fullName')}</th>
                <SortHeader field="status" label={t('admin.sub.status')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th>{t('teachers.subscriptionTitle')}</th>
                <SortHeader field="amount" label={t('teachers.amount')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <SortHeader field="startDate" label={t('teachers.start')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <SortHeader field="endDate" label={t('teachers.end')} sort={sort} onSort={(v) => { setSort(v); setOffset(0); }} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedSubs.map((s: any) => {
                const expSoon = s.status === 'ACTIVE' && s.endDate && +new Date(s.endDate) - Date.now() < 7 * 86400000;
                return (
                  <tr key={s.id}>
                    <td className="row-check">
                      <input type="checkbox" checked={selected.has(s.teacherId)} onChange={() => toggleOne(s.teacherId)} />
                    </td>
                    <td>
                      <Link to={`/admin/teachers/${s.teacher?.id || s.teacherId}`}>
                        {s.teacher?.fullName || s.teacherId}
                      </Link>
                      <div className="muted" style={{ fontSize: 11 }}>{s.teacher?.login}</div>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                      {expSoon && <span className="muted" style={{ fontSize: 11, marginLeft: 6, color: '#b45309' }}>скоро</span>}
                    </td>
                    <td>{s.type || '—'}</td>
                    <td>{s.amount ? `${s.amount.toLocaleString()} ${s.currency || '₽'}` : '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                    <td className="admin-row-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => setExtendTarget(s)}>{t('admin.sub.extend')}</button>
                      <button className="btn btn-sm" onClick={() => setStatusTarget(s)}>{t('admin.sub.status')}</button>
                    </td>
                  </tr>
                );
              })}
              {sortedSubs.length === 0 && <tr><td colSpan={8} className="empty">{t('admin.sub.empty')}</td></tr>}
            </tbody>
          </table>
          <Paginator total={total} limit={limit} offset={offset} onChange={setOffset} />
        </div>
      )}

      {extendTarget && <ExtendModal sub={extendTarget} onClose={() => setExtendTarget(null)} onSaved={() => { invalidateApi('/admin/finance'); refetch(); }} />}
      {statusTarget && <StatusModal sub={statusTarget} onClose={() => setStatusTarget(null)} onSaved={() => { invalidateApi('/admin/finance'); refetch(); }} />}
      {bulkExtendOpen && <BulkExtendModal teacherIds={Array.from(selected)} onClose={() => setBulkExtendOpen(false)} onSaved={() => { setSelected(new Set()); refetch(); }} />}
      {bulkStatusOpen && <BulkStatusModal teacherIds={Array.from(selected)} onClose={() => setBulkStatusOpen(false)} onSaved={() => { setSelected(new Set()); refetch(); }} />}

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <button className="btn btn-primary" onClick={() => setBulkExtendOpen(true)}>{t('admin.sub.extend')}</button>
        <button className="btn" onClick={() => setBulkStatusOpen(true)}>{t('admin.sub.statusChange')}</button>
      </BulkBar>
    </Shell>
  );
}

function ExtendModal({ sub, onClose, onSaved }: any) {
  const { t } = useT();
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(sub?.amount || 0);
  const [comment, setComment] = useState('');
  function save() {
    onClose();
    api.post(`/admin/teachers/${sub.teacherId}/subscription/extend`, { months, amount, comment })
      .then(() => { toast.success(t('admin.sub.extended')); onSaved(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={`${t('admin.sub.extendTitle')}: ${sub.teacher?.fullName || sub.teacherId}`} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('admin.sub.extend')}</button></>}>
      <div className="field"><label>{t('admin.sub.months')}</label>
        <select className="select" value={months} onChange={(e) => setMonths(+e.target.value)}>
          <option value="1">+1 мес.</option>
          <option value="3">+3 мес.</option>
          <option value="6">+6 мес.</option>
          <option value="12">+12 мес.</option>
        </select>
      </div>
      <div className="field"><label>{t('teachers.amount')}</label><input type="number" className="input" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
      <div className="field"><label>{t('admin.sub.comment')}</label><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}

function BulkExtendModal({ teacherIds, onClose, onSaved }: { teacherIds: string[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [months, setMonths] = useState(1);
  const [comment, setComment] = useState('');
  function save() {
    onClose();
    api.post('/admin/subscriptions/bulk-extend', { teacherIds, months, comment })
      .then((r) => { toast.success(`${t('admin.sub.extended')}: ${r.data.count}`); onSaved(); })
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={`${t('admin.sub.bulkExtend')}: ${teacherIds.length}`} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('admin.sub.extend')}</button></>}>
      <div className="field"><label>{t('admin.sub.months')}</label>
        <select className="select" value={months} onChange={(e) => setMonths(+e.target.value)}>
          <option value="1">+1 мес.</option>
          <option value="3">+3 мес.</option>
          <option value="6">+6 мес.</option>
          <option value="12">+12 мес.</option>
        </select>
      </div>
      <div className="field"><label>{t('admin.sub.comment')}</label><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}

function BulkStatusModal({ teacherIds, onClose, onSaved }: { teacherIds: string[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [status, setStatus] = useState('ACTIVE');
  const [comment, setComment] = useState('');
  function save() {
    onClose();
    api.post('/admin/subscriptions/bulk-status', { teacherIds, status, comment })
      .then((r) => { toast.success(`${t('teachers.subUpdated')}: ${r.data.count}`); onSaved(); })
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={`${t('admin.sub.bulkStatus')}: ${teacherIds.length}`} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="field"><label>{t('admin.sub.status')}</label>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
          <option value="TRIAL">TRIAL</option>
        </select>
      </div>
      <div className="field"><label>{t('admin.sub.comment')}</label><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}

function StatusModal({ sub, onClose, onSaved }: any) {
  const { t } = useT();
  const [status, setStatus] = useState(sub.status);
  const [comment, setComment] = useState('');
  function save() {
    onClose();
    api.patch(`/admin/teachers/${sub.teacherId}/subscription/status`, { status, comment })
      .then(() => { toast.success(t('teachers.subUpdated')); onSaved(); })
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <Modal open onClose={onClose} title={`${t('admin.sub.statusChange')}: ${sub.teacher?.fullName || sub.teacherId}`} width={420}
      footer={<><button className="btn" onClick={onClose}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('btn.save')}</button></>}>
      <div className="field"><label>{t('admin.sub.status')}</label>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="TRIAL">TRIAL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
      </div>
      <div className="field"><label>{t('admin.sub.comment')}</label><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}
