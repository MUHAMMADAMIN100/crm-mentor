import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { api, invalidateApi } from '../../api';
import { Modal } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import { toast } from '../../store';
import { useT } from '../../i18n';
import { Kpi, StatusBadge } from '../../components/AdminUI';

export function AdminSubscriptions() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('30d');
  const url = `/admin/finance?search=${encodeURIComponent(search)}&status=${status}&period=${period}`;
  const { data, refetch } = useApi<any>(url);

  const subs = data?.subscriptions || [];
  const counts = data?.counts || {};
  const sortedSubs = useMemo(() => {
    return [...subs].sort((a: any, b: any) => {
      const ae = a.endDate ? +new Date(a.endDate) : Infinity;
      const be = b.endDate ? +new Date(b.endDate) : Infinity;
      return ae - be;
    });
  }, [subs]);

  const [extendTarget, setExtendTarget] = useState<any | null>(null);
  const [statusTarget, setStatusTarget] = useState<any | null>(null);

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
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('admin.sub.allStatuses')}</option>
          <option value="TRIAL">TRIAL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="90d">90 дней</option>
        </select>
      </div>

      {!data ? <SkeletonTable rows={6} cols={7} /> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('profile.fullName')}</th>
                <th>{t('admin.sub.status')}</th>
                <th>{t('teachers.subscriptionTitle')}</th>
                <th>{t('teachers.amount')}</th>
                <th>{t('teachers.start')}</th>
                <th>{t('teachers.end')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedSubs.map((s: any) => {
                const expSoon = s.status === 'ACTIVE' && s.endDate && +new Date(s.endDate) - Date.now() < 7 * 86400000;
                return (
                  <tr key={s.id}>
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
              {sortedSubs.length === 0 && <tr><td colSpan={7} className="empty">{t('admin.sub.empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {extendTarget && <ExtendModal sub={extendTarget} onClose={() => setExtendTarget(null)} onSaved={() => { invalidateApi('/admin/finance'); refetch(); }} />}
      {statusTarget && <StatusModal sub={statusTarget} onClose={() => setStatusTarget(null)} onSaved={() => { invalidateApi('/admin/finance'); refetch(); }} />}
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
