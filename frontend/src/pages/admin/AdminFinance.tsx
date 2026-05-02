import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { Loading } from '../../components/Loading';
import { Kpi, StatusBadge, SortHeader, Paginator } from '../../components/AdminUI';
import { useT } from '../../i18n';

export function AdminFinance() {
  const { t } = useT();
  const [period, setPeriod] = useState('30d');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [managerId, setManagerId] = useState('all');
  const [subType, setSubType] = useState('all');
  const [sort, setSort] = useState('-updated');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const url = `/admin/finance?${new URLSearchParams({
    period,
    ...(status !== 'all' ? { status } : {}),
    ...(source !== 'all' ? { source } : {}),
    ...(managerId !== 'all' ? { managerId } : {}),
    ...(subType !== 'all' ? { subType } : {}),
    ...(sort ? { sort } : {}),
    limit: String(limit),
    offset: String(offset),
  }).toString()}`;
  const { data, loading } = useApi<any>(url);
  const { data: managersResp } = useApi<any>('/admin/managers');
  const managers: any[] = Array.isArray(managersResp) ? managersResp : managersResp?.items || [];

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
    return list;
  }, [data, search]);

  const knownSources = useMemo(() => {
    const set = new Set<string>();
    (data?.subscriptions || []).forEach((s: any) => { if (s.source) set.add(s.source); });
    return Array.from(set);
  }, [data]);

  function rowsForExport() {
    return subs.map((s: any) => ({
      Учитель: s.teacher?.fullName || '',
      Логин: s.teacher?.login || '',
      Email: s.teacher?.email || '',
      Статус: s.status,
      Тариф: s.type || '',
      'Сумма': s.amount || 0,
      Валюта: s.currency || 'RUB',
      'Источник оплаты': s.source || '',
      Комментарий: s.comment || '',
      'Кто внёс': s.history?.[0]?.actor?.fullName || '',
      'Начало': s.startDate ? new Date(s.startDate).toLocaleDateString() : '',
      'Конец': s.endDate ? new Date(s.endDate).toLocaleDateString() : '',
      'Обновлено': new Date(s.updatedAt).toLocaleDateString(),
    }));
  }

  function exportCsv() {
    if (!subs.length) return;
    const rows = rowsForExport();
    const headers = Object.keys(rows[0]);
    const csv = '﻿' + [headers, ...rows.map((r: any) => headers.map((h) => r[h]))]
      .map((r: any[]) => r.map((c) => {
        const v = String(c).replace(/"/g, '""');
        return /[",;\n]/.test(v) ? `"${v}"` : v;
      }).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miz-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportXlsx() {
    if (!subs.length) return;
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.json_to_sheet(rowsForExport());
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Finance');
    xlsx.writeFile(wb, `miz-finance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!data && loading) return <Shell title={t('finance.title')}><Loading label={t('loader.finance')} /></Shell>;
  if (!data) return null;

  return (
    <Shell title={t('finance.title')}>
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

      <div className="admin-toolbar" style={{ marginTop: 16 }}>
        <input className="input search" placeholder={t('admin.fin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.sub.allStatuses')}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
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
        <select className="select" value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.fin.sourceAny')}</option>
          {knownSources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={managerId} onChange={(e) => { setManagerId(e.target.value); setOffset(0); }}>
          <option value="all">{t('admin.fin.managerAny')}</option>
          {managers.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
        </select>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ maxWidth: 120 }}>
          <option value="7d">7 дн.</option>
          <option value="30d">30 дн.</option>
          <option value="90d">90 дн.</option>
        </select>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}>⬇ CSV</button>
        <button className="btn" onClick={exportXlsx}>⬇ XLSX</button>
      </div>

      <div className="card" style={{ padding: 0, marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.fin.col.teacher')}</th>
              <SortHeader field="status" label={t('admin.fin.col.status')} sort={sort} onSort={setSort} />
              <th>{t('admin.fin.col.type')}</th>
              <SortHeader field="amount" label={t('admin.fin.col.amount')} sort={sort} onSort={setSort} />
              <th>{t('admin.fin.col.source')}</th>
              <th>{t('admin.fin.col.comment')}</th>
              <th>{t('admin.fin.col.actor')}</th>
              <SortHeader field="endDate" label={t('admin.fin.col.until')} sort={sort} onSort={setSort} />
              <SortHeader field="updated" label={t('admin.fin.col.updated')} sort={sort} onSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {subs.map((s: any) => {
              const isExpired = s.status === 'EXPIRED' || (s.endDate && new Date(s.endDate) < new Date() && s.status === 'ACTIVE');
              const expSoon = s.status === 'ACTIVE' && s.endDate && +new Date(s.endDate) - Date.now() < 7 * 86400000;
              const lastChange = s.history?.[0];
              return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/admin/teachers/${s.teacher?.id || s.teacherId}`}>{s.teacher?.fullName || '—'}</Link>
                    <div className="muted" style={{ fontSize: 11 }}>{s.teacher?.login}{s.teacher?.archived && ' · архив'}</div>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>{s.type || '—'}</td>
                  <td>{s.amount ? `${s.amount.toLocaleString()} ${s.currency || '₽'}` : '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{s.source || '—'}</td>
                  <td style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.comment || ''}>
                    {s.comment || '—'}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{lastChange?.actor?.fullName || '—'}</td>
                  <td style={{ color: isExpired ? 'var(--danger)' : expSoon ? '#b45309' : undefined }}>
                    {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(s.updatedAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {subs.length === 0 && (
              <tr><td colSpan={9} className="empty">{t('empty.noFound')}</td></tr>
            )}
          </tbody>
        </table>
        <Paginator total={data.total || 0} limit={limit} offset={offset} onChange={setOffset} />
      </div>
    </Shell>
  );
}
