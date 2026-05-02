import { useState } from 'react';
import { Modal } from './Modal';
import { useT } from '../i18n';
import { toast } from '../store';

/**
 * Generic CSV/XLSX import modal. Reads file client-side, shows a preview
 * of the first 5 rows, lets the user confirm, then POSTs to the supplied
 * endpoint. The expected schema is described in `requiredFields`.
 */
export function ImportModal({
  open, onClose, title, requiredFields, optionalFields, onImport, extraPayload,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  requiredFields: string[];
  optionalFields?: string[];
  /** Function that receives parsed rows and resolves with the server result. */
  onImport: (rows: any[]) => Promise<{ created: number; skipped: number; errors: string[] }>;
  extraPayload?: ReactNode;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<any[] | null>(null);
  const [filename, setFilename] = useState('');
  const [working, setWorking] = useState(false);
  const [report, setReport] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  async function onFile(f: File) {
    setFilename(f.name);
    setReport(null);
    try {
      let parsed: any[] = [];
      if (f.name.toLowerCase().endsWith('.csv')) {
        const text = await f.text();
        parsed = parseCsv(text);
      } else {
        const xlsx = await import('xlsx');
        const buf = await f.arrayBuffer();
        const wb = xlsx.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        parsed = xlsx.utils.sheet_to_json(ws, { defval: '' }) as any[];
      }
      setRows(parsed);
    } catch (e: any) {
      toast.error(e?.message || t('admin.import.parseFail'));
      setRows(null);
    }
  }

  async function start() {
    if (!rows || rows.length === 0) return;
    // Validate required fields
    const missing: string[] = [];
    rows.slice(0, 5).forEach((r, i) => {
      requiredFields.forEach((f) => {
        if (!r[f] && r[f] !== 0) missing.push(`${t('admin.import.row')} ${i + 1}: ${f}`);
      });
    });
    if (missing.length > 0) {
      toast.warning(`${t('admin.import.requiredMissing')}: ${missing.slice(0, 3).join('; ')}`);
      return;
    }
    setWorking(true);
    try {
      const r = await onImport(rows);
      setReport(r);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('admin.import.serverFail'));
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setRows(null);
    setFilename('');
    setReport(null);
  }

  if (!open) return null;
  const headers = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
  const preview = (rows || []).slice(0, 5);

  return (
    <Modal open onClose={onClose} title={title} width={780}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('btn.cancel')}</button>
          {rows && !report && <button className="btn" onClick={reset}>{t('admin.import.changeFile')}</button>}
          {rows && !report && <button className="btn btn-primary" onClick={start} disabled={working}>{working ? t('status.loading') : `${t('admin.import.import')} ${rows.length}`}</button>}
          {report && <button className="btn btn-primary" onClick={onClose}>{t('btn.close')}</button>}
        </>
      }>
      {!rows && (
        <>
          <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
            <strong>{t('admin.import.requiredFields')}:</strong> {requiredFields.join(', ')}
            {optionalFields && optionalFields.length > 0 && (
              <>
                <br />
                <strong>{t('admin.import.optionalFields')}:</strong> {optionalFields.join(', ')}
              </>
            )}
          </div>
          {extraPayload}
          <div style={{
            border: '2px dashed var(--border)', borderRadius: 12, padding: 28,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📂</div>
            <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>{t('admin.import.dropHint')}</div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        </>
      )}

      {rows && !report && (
        <>
          <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
            {filename} · {rows.length} {t('admin.import.rowsParsed')}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 320 }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => <td key={h}>{String(r[h] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>… +{rows.length - 5} {t('admin.import.moreRows')}</div>}
        </>
      )}

      {report && (
        <>
          <div style={{ display: 'flex', gap: 16, padding: 14, marginBottom: 12, background: 'var(--surface-2)', borderRadius: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>{t('admin.import.created')}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{report.created}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>{t('admin.import.skipped')}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: report.skipped > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{report.skipped}</div>
            </div>
          </div>
          {report.errors.length > 0 && (
            <div className="card" style={{ padding: 10, maxHeight: 240, overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{t('admin.import.errorList')}</h4>
              {report.errors.map((e, i) => (
                <div key={i} className="muted" style={{ fontSize: 12, padding: '2px 0' }}>• {e}</div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// Tiny CSV parser — handles simple quoted fields, comma or semicolon.
function parseCsv(text: string): any[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], sep);
  return lines.slice(1).map((ln) => {
    const vals = splitCsvLine(ln, sep);
    const row: any = {};
    headers.forEach((h, i) => { row[h.trim()] = vals[i] ?? ''; });
    return row;
  });
}
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

import { ReactNode } from 'react';
