import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { useApi } from '../../hooks';
import { Loading } from '../../components/Loading';
import { useT } from '../../i18n';

type Status = 'ALL' | 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED';
type Sort = 'recent' | 'amountDesc' | 'amountAsc' | 'expiringSoon';

export function AdminFinance() {
  const { t } = useT();
  const { data, loading } = useApi<any>('/admin/finance');
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
        <Kpi label="Общая выручка" value={`${(data.totalRevenue || 0).toLocaleString()} ₽`} accent="primary" />
        <Kpi label="MRR (активные)" value={`${(data.activeRevenue || 0).toLocaleString()} ₽`} accent="success" />
        <Kpi label="Активные" value={data.counts?.ACTIVE || 0} accent="success" />
        <Kpi label="Trial" value={data.counts?.TRIAL || 0} accent="warning" />
        <Kpi label="Просроченные" value={data.counts?.EXPIRED || 0} accent="danger" />
        <Kpi label="Заблокированы" value={data.counts?.BLOCKED || 0} accent="muted" />
      </div>

      {/* Toolbar */}
      <div className="fin-toolbar" style={{ marginTop: 16 }}>
        <input className="input" placeholder="🔍 Поиск по ФИО / логину / email" style={{ maxWidth: 320 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="ALL">Все статусы</option>
          <option value="ACTIVE">Активная</option>
          <option value="TRIAL">Пробный</option>
          <option value="EXPIRED">Истёкшая</option>
          <option value="BLOCKED">Заблокирована</option>
        </select>
        <select className="select" style={{ maxWidth: 200 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Недавно изменённые</option>
          <option value="amountDesc">Сумма ↓</option>
          <option value="amountAsc">Сумма ↑</option>
          <option value="expiringSoon">Скоро закончатся</option>
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
                    <div style={{ fontWeight: 500 }}>{s.teacher?.fullName || '—'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{s.teacher?.login}{s.teacher?.archived && ' · архив'}</div>
                  </td>
                  <td><span className={`badge badge-${badgeForStatus(s.status, isExpired)}`}>{statusLabel(s.status)}</span></td>
                  <td>{s.type || '—'}</td>
                  <td>{s.amount ? `${s.amount.toLocaleString()} ₽` : '—'}</td>
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

function Kpi({ label, value, accent }: any) {
  const color =
    accent === 'success' ? 'var(--success)'
      : accent === 'warning' ? '#b45309'
      : accent === 'danger' ? 'var(--danger)'
      : accent === 'muted' ? 'var(--text-muted)'
      : 'var(--primary)';
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
    </div>
  );
}

function statusLabel(s: string) {
  return ({
    ACTIVE: 'Активная',
    TRIAL: 'Trial',
    EXPIRED: 'Истёкшая',
    BLOCKED: 'Заблокирована',
  } as any)[s] || s;
}
function badgeForStatus(s: string, expired: boolean) {
  if (expired || s === 'EXPIRED') return 'danger';
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL') return 'warning';
  return 'past';
}
