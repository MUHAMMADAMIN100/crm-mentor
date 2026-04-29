import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { useAuth, toast } from '../../store';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';

export function TeacherFinance() {
  const [data, setData] = useState<any>(null);
  const { user, refreshMe } = useAuth();
  const [currency, setCurrency] = useState((user as any)?.teacherCurrency || 'RUB');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [search, setSearch] = useState('');
  const [topupTarget, setTopupTarget] = useState<any | null>(null);

  function load() { api.get('/finance/teacher').then((r) => setData(r.data)).catch(() => toast.error('Не удалось загрузить финансы')); }
  useEffect(load, []);

  async function saveCurrency() {
    try {
      await api.patch('/teacher/currency', { currency });
      await refreshMe();
      toast.success('Валюта обновлена');
      load();
    } catch { toast.error('Не удалось обновить валюту'); }
  }

  const periodMs = useMemo(() => {
    if (period === '7d') return 7 * 86400000;
    if (period === '30d') return 30 * 86400000;
    if (period === '90d') return 90 * 86400000;
    return Infinity;
  }, [period]);

  const filteredPayments = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - periodMs;
    return (data.recentPayments || []).filter((p: any) => +new Date(p.createdAt) >= cutoff);
  }, [data, periodMs]);

  const periodTotals = useMemo(() => {
    let income = 0, charged = 0;
    filteredPayments.forEach((p: any) => {
      if (p.kind === 'TOPUP') income += p.amount;
      if (p.kind === 'CHARGE') charged += p.amount;
    });
    return { income, charged, net: income - charged };
  }, [filteredPayments]);

  // simple bars: aggregate income per day for the period
  const incomeByDay = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((p: any) => {
      if (p.kind !== 'TOPUP') return;
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + p.amount);
    });
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    return { entries, max };
  }, [filteredPayments]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s: any) => !q || s.fullName.toLowerCase().includes(q));
  }, [data, search]);

  function exportCsv() {
    if (!data) return;
    const cur = data.currency || 'RUB';
    const rows: string[][] = [];
    rows.push(['Дата', 'Ученик', 'Тип', 'Сумма', 'Валюта', 'Комментарий']);
    const studentName = (sid: string) => data.students.find((s: any) => s.id === sid)?.fullName || sid;
    filteredPayments.forEach((p: any) => {
      const kindLabel = p.kind === 'TOPUP' ? 'Поступление' : p.kind === 'CHARGE' ? 'Списание' : 'Корректировка';
      rows.push([
        new Date(p.createdAt).toLocaleString('ru-RU'),
        studentName(p.studentId),
        kindLabel,
        String(p.amount),
        cur,
        p.comment || '',
      ]);
    });
    const csv = '﻿' + rows.map((r) => r.map((c) => {
      const v = String(c).replace(/"/g, '""');
      return /[",;\n]/.test(v) ? `"${v}"` : v;
    }).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miz-finance-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV-файл скачан');
  }

  if (!data) return <Shell title="Финансы"><Loading label="Загружаем финансы…" /></Shell>;

  const cur = data.currency || 'RUB';

  return (
    <Shell title="Финансы">
      {/* Currency picker */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex" style={{ flexWrap: 'wrap' }}>
          <strong style={{ marginRight: 8 }}>Валюта:</strong>
          <select className="select" style={{ maxWidth: 200 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="RUB">₽ Рубль</option>
            <option value="USD">$ Доллар</option>
            <option value="EUR">€ Евро</option>
            <option value="KZT">₸ Тенге</option>
            <option value="UZS">сум Сум</option>
          </select>
          {currency !== cur && <button className="btn btn-primary" onClick={saveCurrency}>Сохранить</button>}
          <div className="spacer" />
          <span className="muted" style={{ fontSize: 12 }}>Применяется ко всем ученикам</span>
        </div>
      </div>

      {/* Period & toolbar */}
      <div className="fin-toolbar">
        <strong>Период:</strong>
        {(['7d', '30d', '90d', 'all'] as const).map((p) => (
          <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : ''}`} onClick={() => setPeriod(p)}>
            {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : p === '90d' ? '90 дней' : 'Всё время'}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}>⬇ Экспорт CSV</button>
      </div>

      {/* Stats */}
      <div className="fin-stats">
        <div className="fin-stat in">
          <div className="label"><span className="label-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg></span>Поступления за период</div>
          <div className="value">{periodTotals.income.toLocaleString('ru-RU')} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-soft)' }}>{cur}</span></div>
          <div className="sub">{filteredPayments.filter((p: any) => p.kind === 'TOPUP').length} операций</div>
        </div>
        <div className="fin-stat out">
          <div className="label"><span className="label-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg></span>Списания за период</div>
          <div className="value">{periodTotals.charged.toLocaleString('ru-RU')} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-soft)' }}>{cur}</span></div>
          <div className="sub">{filteredPayments.filter((p: any) => p.kind === 'CHARGE').length} списаний</div>
        </div>
        <div className="fin-stat bal">
          <div className="label"><span className="label-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>Чистая динамика</div>
          <div className="value" style={{ color: periodTotals.net < 0 ? 'var(--danger)' : 'var(--primary)' }}>
            {periodTotals.net >= 0 ? '+' : ''}{periodTotals.net.toLocaleString('ru-RU')} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-soft)' }}>{cur}</span>
          </div>
          <div className="sub">за выбранный период</div>
        </div>
        <div className="fin-stat debt">
          <div className="label"><span className="label-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /></svg></span>Текущие долги</div>
          <div className="value">{(data.totals.totalDebt || 0).toLocaleString('ru-RU')} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-soft)' }}>{cur}</span></div>
          <div className="sub">{data.students.filter((s: any) => s.balance < 0).length} ученик(ов) в минусе</div>
        </div>
      </div>

      {/* Mini chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Поступления по дням</h3>
        {incomeByDay.entries.length === 0 ? (
          <div className="empty">За период поступлений не было</div>
        ) : (
          <div className="fin-bars">
            {incomeByDay.entries.map(([d, v]) => (
              <div
                key={d}
                className="bar"
                style={{ height: `${Math.max(3, (v / incomeByDay.max) * 100)}%` }}
                title={`${d}: ${v.toLocaleString('ru-RU')} ${cur}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Students table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Ученики</h3>
          <div className="spacer" />
          <input className="input" placeholder="🔍 Поиск по имени" style={{ maxWidth: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Стоимость занятия</th>
              <th>Баланс</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s: any) => (
              <tr key={s.id}>
                <td>{s.fullName}</td>
                <td>{s.individualPrice ?? '—'}</td>
                <td>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 500,
                    background: s.balance < 0 ? '#fee2e2' : s.balance === 0 ? 'var(--surface-2)' : '#dcfce7',
                    color: s.balance < 0 ? 'var(--danger)' : s.balance === 0 ? 'var(--text-muted)' : 'var(--success)',
                  }}>
                    {s.balance.toLocaleString('ru-RU')} {cur}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => setTopupTarget(s)}>+ Пополнить</button>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr><td colSpan={4} className="empty">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {topupTarget && (
        <TopupModal student={topupTarget} cur={cur} onClose={(refresh) => { setTopupTarget(null); if (refresh) load(); }} />
      )}
    </Shell>
  );
}

function TopupModal({ student, cur, onClose }: any) {
  const [amount, setAmount] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount || amount <= 0) { toast.warning('Сумма должна быть положительной'); return; }
    setSaving(true);
    try {
      await api.post(`/finance/teacher/students/${student.id}/topup`, { amount, comment });
      toast.success(`Баланс пополнен: +${amount} ${cur}`);
      onClose(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ошибка пополнения');
    } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={() => onClose(false)} title={`Пополнить — ${student.fullName}`}
      footer={<><button className="btn" onClick={() => onClose(false)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохраняем…' : 'Пополнить'}</button></>}>
      <p className="muted" style={{ marginTop: 0 }}>Текущий баланс: <strong style={{ color: student.balance < 0 ? 'var(--danger)' : 'var(--text)' }}>{student.balance} {cur}</strong></p>
      <div className="field">
        <label>Сумма пополнения, {cur}</label>
        <input className="input" type="number" min={1} value={amount || ''} onChange={(e) => setAmount(+e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Комментарий (необязательно)</label>
        <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: оплата за май" />
      </div>
    </Modal>
  );
}
