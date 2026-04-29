import { useEffect, useMemo, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { useAuth, toast } from '../../store';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function TeacherFinance() {
  const [data, setData] = useState<any>(null);
  const { user, refreshMe } = useAuth();
  const [currency, setCurrency] = useState((user as any)?.teacherCurrency || 'RUB');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [search, setSearch] = useState('');
  const [topupTarget, setTopupTarget] = useState<any | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const periodLabel = period === '7d' ? 'Последние 7 дней'
    : period === '30d' ? 'Последние 30 дней'
    : period === '90d' ? 'Последние 90 дней'
    : 'За всё время';

  async function exportPdf() {
    if (!data || !reportRef.current) return;
    setGenerating(true);
    try {
      // Make hidden report visible to html2canvas (off-screen but rendered)
      const node = reportRef.current;
      node.style.display = 'block';
      // Wait one tick so layout settles
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      node.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const filename = `miz-finance-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
      setPdfPreview({ url, filename });
    } catch (e: any) {
      console.error('[exportPdf]', e);
      toast.error('Не удалось сформировать PDF');
    } finally {
      setGenerating(false);
    }
  }

  function closePdfPreview() {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
    setPdfPreview(null);
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
        <button className="btn" onClick={exportPdf} disabled={generating}>
          {generating ? 'Готовим PDF…' : '📄 Экспорт PDF'}
        </button>
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

      {/* Off-screen PDF report (hidden, rendered only when generating) */}
      <div ref={reportRef} className="pdf-report" style={{ display: 'none' }}>
        <PdfReport
          data={data}
          cur={cur}
          period={periodLabel}
          totals={periodTotals}
          payments={filteredPayments}
          incomeByDay={incomeByDay}
          teacherName={(user as any)?.fullName || ''}
        />
      </div>

      {topupTarget && (
        <TopupModal student={topupTarget} cur={cur} onClose={(refresh) => { setTopupTarget(null); if (refresh) load(); }} />
      )}

      {pdfPreview && <PdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />}
    </Shell>
  );
}

function PdfReport({ data, cur, period, totals, payments, incomeByDay, teacherName }: any) {
  const studentName = (sid: string) => data.students.find((s: any) => s.id === sid)?.fullName || sid;
  const now = new Date().toLocaleString('ru-RU');
  return (
    <div style={{
      width: 794, // ~A4 width at 96dpi
      padding: 40,
      background: '#fff',
      color: '#1f1d2b',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      fontSize: 12,
      lineHeight: 1.5,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingBottom: 18, borderBottom: '2px solid #7c3aed', marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', letterSpacing: '-0.02em' }}>Miz</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>Финансовый отчёт</div>
          <div style={{ color: '#6b6c7e', marginTop: 4 }}>{teacherName} · {period}</div>
        </div>
        <div style={{ textAlign: 'right', color: '#6b6c7e', fontSize: 11 }}>
          <div>Сформировано</div>
          <div style={{ fontWeight: 500, color: '#1f1d2b' }}>{now}</div>
          <div style={{ marginTop: 2 }}>Валюта: <strong style={{ color: '#1f1d2b' }}>{cur}</strong></div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <SummaryBox label="Поступления" value={totals.income} cur={cur} color="#16a34a" />
        <SummaryBox label="Списания" value={totals.charged} cur={cur} color="#b45309" />
        <SummaryBox label="Чистая динамика" value={totals.net} cur={cur} color={totals.net < 0 ? '#dc2626' : '#7c3aed'} prefix={totals.net >= 0 ? '+' : ''} />
        <SummaryBox label="Долги" value={data.totals.totalDebt || 0} cur={cur} color="#dc2626" />
      </div>

      {/* Income by day chart */}
      {incomeByDay.entries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Поступления по дням</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${incomeByDay.entries.length}, 1fr)`,
            gap: 3, alignItems: 'end', height: 70,
            padding: 10, background: '#faf9ff', borderRadius: 10, border: '1px solid #ede9fe',
          }}>
            {incomeByDay.entries.map(([d, v]: any) => (
              <div key={d} style={{
                background: 'linear-gradient(180deg, #7c3aed, #a78bfa)',
                height: `${Math.max(4, (v / incomeByDay.max) * 100)}%`,
                borderRadius: '3px 3px 0 0',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Payments table */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
          Платежи за период ({payments.length})
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: 14, color: '#9b9caf', textAlign: 'center', background: '#f7f7fb', borderRadius: 8 }}>
            Платежей за период не было
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f5f3ff' }}>
                <th style={th}>Дата</th>
                <th style={th}>Ученик</th>
                <th style={th}>Тип</th>
                <th style={{ ...th, textAlign: 'right' }}>Сумма</th>
                <th style={th}>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 50).map((p: any) => (
                <tr key={p.id}>
                  <td style={td}>{new Date(p.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td style={td}>{studentName(p.studentId)}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                      background: p.kind === 'TOPUP' ? '#dcfce7' : p.kind === 'CHARGE' ? '#fef3c7' : '#ede9fe',
                      color: p.kind === 'TOPUP' ? '#16a34a' : p.kind === 'CHARGE' ? '#b45309' : '#5b21b6',
                    }}>
                      {p.kind === 'TOPUP' ? 'Поступление' : p.kind === 'CHARGE' ? 'Списание' : 'Корректировка'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>
                    {p.kind === 'CHARGE' ? '−' : '+'}{p.amount.toLocaleString('ru-RU')} {cur}
                  </td>
                  <td style={{ ...td, color: '#6b6c7e' }}>{p.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {payments.length > 50 && (
          <div style={{ fontSize: 10, color: '#9b9caf', marginTop: 6 }}>
            Показаны первые 50 операций из {payments.length}
          </div>
        )}
      </div>

      {/* Students table */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
          Ученики и балансы ({data.students.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f5f3ff' }}>
              <th style={th}>Ученик</th>
              <th style={{ ...th, textAlign: 'right' }}>Стоимость занятия</th>
              <th style={{ ...th, textAlign: 'right' }}>Баланс</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s: any) => (
              <tr key={s.id}>
                <td style={td}>{s.fullName}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {s.individualPrice != null ? `${s.individualPrice.toLocaleString('ru-RU')} ${cur}` : '—'}
                </td>
                <td style={{
                  ...td, textAlign: 'right', fontWeight: 600,
                  color: s.balance < 0 ? '#dc2626' : s.balance > 0 ? '#16a34a' : '#9b9caf',
                }}>
                  {s.balance.toLocaleString('ru-RU')} {cur}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 30, paddingTop: 14, borderTop: '1px solid #ececf3',
        display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9b9caf',
      }}>
        <div>Сгенерировано в Miz CRM</div>
        <div>{now}</div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 10,
  fontWeight: 600,
  color: '#6b6c7e',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #ddd6fe',
};
const td: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #ececf3',
};

function SummaryBox({ label, value, cur, color, prefix = '' }: any) {
  return (
    <div style={{ background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#6b6c7e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.1 }}>
        {prefix}{Number(value).toLocaleString('ru-RU')} <span style={{ fontSize: 11, fontWeight: 500, color: '#9b9caf' }}>{cur}</span>
      </div>
    </div>
  );
}

function PdfPreviewModal({ preview, onClose }: { preview: { url: string; filename: string }; onClose: () => void }) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal pdf-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: 12 }}>
          <h3 id="pdf-preview-title">Предпросмотр PDF</h3>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="pdf-preview-body">
          <iframe
            src={preview.url}
            title="PDF preview"
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#525659' }}
          />
        </div>
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Закрыть</button>
          <a className="btn btn-primary" href={preview.url} download={preview.filename}>
            ⬇ Скачать PDF
          </a>
        </div>
      </div>
    </div>
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
