import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { Loading } from '../../components/Loading';
import { Kpi, StatusBadge } from '../../components/AdminUI';
import { useT } from '../../i18n';

type Status = 'ALL' | 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'PAUSED' | 'CANCELED';
type Sort = 'recent' | 'amountDesc' | 'amountAsc' | 'expiringSoon';

export function AdminFinance() {
  const { t } = useT();
  const [period, setPeriod] = useState('30d');
  const { data, loading } = useApi<any>(`/admin/finance?period=${period}`);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('ALL');
  const [sort, setSort] = useState<Sort>('recent');

  const subs = useMemo(() => {
    if (!data?.subscriptions) return [];
    let list = data.subscriptions.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s: any) =>
        (s.teacher?.fullName || '').toLowerCase().includes(q) ||
        (s.teacher?.login || '').toLowerCase().includes(q) ||
        (s.teacher?.email || '').toLowerCase().includes(q),
      );
    }
    if (status !== 'ALL') list = list.filter((s: any) => s.status === status);
    if (sort === 'amountDesc') list.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0));
    else if (sort === 'amountAsc') list.sort((a: any, b: any) => (a.amount || 0) - (b.amount || 0));
    else if (sort === 'expiringSoon') list.sort((a: any, b: any) => {
      const ax = a.endDate ? +new Date(a.endDate) : Infinity;
      const bx = b.endDate ? +new Date(b.endDate) : Infinity;
      return ax - bx;
    });
    else list.sort((a: any, b: any) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list;
  }, [data, search, status, sort]);

  function exportCsv() {
    if (!subs.length) return;
    const rows: string[][] = [];
    rows.push(['Учитель', 'Логин', 'Email', 'Статус', 'Тариф', 'Сумма ₽', 'Начало', 'Конец', 'Обновлено']);
    subs.forEach((s: any) => rows.push([
      s.teacher?.fullName || '',
      s.teacher?.login || '',
      s.teacher?.email || '',
      s.status,
      s.type || '',
      String(s.amount || 0),
      s.startDate ? new Date(s.startDate).toLocaleDateString() : '',
      s.endDate ? new Date(s.endDate).toLocaleDateString() : '',
      new Date(s.updatedAt).toLocaleDateString(),
    ]));
    const csv = '﻿' + rows.map((r) => r.map((c) => {
      const v = String(c).replace(/"/g, '""');
      return /[",;\n]/.test(v) ? `"${v}"` : v;
    }).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miz-admin-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!data && loading) return <Shell title={t('finance.title')}><Loading label={t('loader.finance')} /></Shell>;
  if (!data) return null;

  return (
    <Shell title={t('finance.title')}>
      {/* KPIs */}
      <div className="kpi-grid">
        <Kpi label={t('admin.fin.totalRevenue')} value={`${(data.totalRevenue || 0).toLocaleString()} ₽`} accent="primary" />
        <Kpi label={t('admin.fin.mrr')} value={`${Math.round(data.mrr || 0).toLocaleString()} ₽`} accent="success" hint={t('admin.fin.mrrHint')} />
        <Kpi label={t('admin.fin.arpu')} value={`${Math.round(data.arpu || 0).toLocaleString()} ₽`} accent="primary" hint={t('admin.fin.arpuHint')} />
        <Kpi label={t('admin.fin.churn')} value={`${Math.round((data.churnRate || 0) * 100)}%`} accent="danger" hint={t('admin.fin.churnHint')} />
        <Kpi label={t('admin.fin.periodRevenue')} value={`${(data.periodRevenue || 0).toLocaleString()} ₽`} accent="primary" />
        <Kpi label={t('admin.fin.active')} value={data.counts?.ACTIVE || 0} accent="success" />
        <Kpi label={t('admin.fin.trial')} value={data.counts?.TRIAL || 0} accent="warning" />
        <Kpi label={t('admin.fin.expired')} value={data.counts?.EXPIRED || 0} accent="danger" />
      </div>

      {/* Toolbar */}
      <div className="fin-toolbar" style={{ marginTop: 16 }}>
        <input className="input" placeholder={t('admin.fin.search')} style={{ maxWidth: 320 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="ALL">{t('admin.sub.allStatuses')}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <select className="select" style={{ maxWidth: 200 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">{t('admin.fin.sortRecent')}</option>
          <option value="amountDesc">{t('admin.fin.sortAmountDesc')}</option>
          <option value="amountAsc">{t('admin.fin.sortAmountAsc')}</option>
          <option value="expiringSoon">{t('admin.fin.sortExpiring')}</option>
        </select>
        <select className="select" style={{ maxWidth: 140 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="7d">7 дн.</option>
          <option value="30d">30 дн.</option>
          <option value="90d">90 дн.</option>
        </select>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}>⬇ CSV</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Учитель</th>
              <th>Статус</th>
              <th>Тариф</th>
              <th>Сумма</th>
              <th>До</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s: any) => {
              const isExpired = s.status === 'EXPIRED' || (s.endDate && new Date(s.endDate) < new Date() && s.status === 'ACTIVE');
              const expSoon = s.status === 'ACTIVE' && s.endDate && +new Date(s.endDate) - Date.now() < 7 * 86400000;
              return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/admin/teachers/${s.teacher?.id || s.teacherId}`}>{s.teacher?.fullName || '—'}</Link>
                    <div className="muted" style={{ fontSize: 11 }}>{s.teacher?.login}{s.teacher?.archived && ' · архив'}</div>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>{s.type || '—'}</td>
                  <td>{s.amount ? `${s.amount.toLocaleString()} ${s.currency || '₽'}` : '—'}</td>
                  <td style={{ color: isExpired ? 'var(--danger)' : expSoon ? '#b45309' : undefined }}>
                    {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(s.updatedAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {subs.length === 0 && (
              <tr><td colSpan={6} className="empty">{t('empty.noFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

