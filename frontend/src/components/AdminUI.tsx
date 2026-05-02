/**
 * Reusable building blocks shared across the admin panel: KPI tile, status
 * badge, simple sparkline / bar chart, status pill mappings.
 */
import { ReactNode } from 'react';

type Accent = 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'neutral';

const ACCENT_COLORS: Record<Accent, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: '#b45309',
  danger: 'var(--danger)',
  muted: 'var(--text-muted)',
  neutral: 'var(--text)',
};

export function Kpi({
  label, value, sub, accent = 'primary', icon, hint,
}: { label: string; value: any; sub?: string; accent?: Accent; icon?: ReactNode; hint?: string }) {
  return (
    <div className="card kpi-card" title={hint}>
      <div className="kpi-label-row">
        {icon && <span className="kpi-icon" style={{ color: ACCENT_COLORS[accent] }}>{icon}</span>}
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value" style={{ color: ACCENT_COLORS[accent] }}>{value ?? '—'}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const STATUS_VARIANT: Record<string, Accent> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  EXPIRED: 'danger',
  BLOCKED: 'danger',
  PAUSED: 'muted',
  CANCELED: 'muted',
  PUBLISHED_PRIVATE: 'success',
  DRAFT: 'muted',
  ARCHIVED: 'danger',
  COMPLETED: 'success',
  PLANNED: 'primary',
  PAST: 'muted',
  SUPER_ADMIN: 'danger',
  ADMIN: 'primary',
  SUPPORT: 'warning',
  SALES: 'success',
};

const STATUS_LABEL_RU: Record<string, string> = {
  ACTIVE: 'Активна',
  TRIAL: 'Trial',
  EXPIRED: 'Истекла',
  BLOCKED: 'Заблокирована',
  PAUSED: 'Пауза',
  CANCELED: 'Отменена',
  PUBLISHED_PRIVATE: 'Опубликован',
  DRAFT: 'Черновик',
  ARCHIVED: 'Архив',
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  SALES: 'Sales',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const variant = STATUS_VARIANT[status] || 'neutral';
  const text = label || STATUS_LABEL_RU[status] || status;
  return <span className={`status-badge status-${variant}`}>{text}</span>;
}

/** Tiny bar chart — last N values, hover shows the value. */
export function MiniBars({ data, height = 56, color = 'var(--primary)' }: { data: { key: string; value: number }[]; height?: number; color?: string }) {
  if (!data || data.length === 0) return <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>—</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mini-bars" style={{ height }}>
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.value / max) * (height - 6)));
        return (
          <div key={d.key} className="mini-bars-col" title={`${d.key}: ${d.value.toLocaleString()}`}>
            <div className="mini-bars-bar" style={{ height: h, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmBanner({ message }: { message: string }) {
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
      <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>{message}</div>
    </div>
  );
}

/**
 * Floating action bar that appears at the bottom of the screen when bulk
 * selection is active. Used by AdminTeachers / AdminStudents tables.
 */
export function BulkBar({
  count, onClear, children,
}: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar">
      <span className="bulk-bar-count">{count}</span>
      <button className="bulk-bar-clear" onClick={onClear} title="Снять выделение">×</button>
      <div className="bulk-bar-actions">{children}</div>
    </div>
  );
}

/**
 * Server-side pagination control. Pass `total`, `limit`, `offset` and the
 * setter; renders «← Prev | page X of Y | Next →» with item count.
 */
export function Paginator({
  total, limit, offset, onChange,
}: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const prev = () => onChange(Math.max(0, offset - limit));
  const next = () => onChange(Math.min((pages - 1) * limit, offset + limit));
  return (
    <div className="paginator">
      <button className="btn btn-sm" onClick={prev} disabled={page === 1}>← Назад</button>
      <span className="muted" style={{ fontSize: 13 }}>Стр. <strong>{page}</strong> из {pages} · всего {total}</span>
      <button className="btn btn-sm" onClick={next} disabled={page === pages}>Вперёд →</button>
    </div>
  );
}

/**
 * Clickable column header that toggles sort direction.
 * Pass `sort` (current sort key) and `onSort` (set new sort key).
 * Convention: passing the same key flips direction (asc/desc).
 */
export function SortHeader({
  field, label, sort, onSort,
}: { field: string; label: string; sort: string; onSort: (next: string) => void }) {
  const baseField = sort.replace(/^-/, '');
  const isActive = baseField === field;
  const isDesc = isActive && sort.startsWith('-');
  function click() {
    if (!isActive) onSort(field);             // first click: ascending
    else if (!isDesc) onSort(`-${field}`);    // second click: descending
    else onSort('');                          // third click: unsort
  }
  return (
    <th onClick={click} className={`sort-header ${isActive ? 'is-active' : ''}`} role="button">
      {label}
      <span className="sort-arrow">{isActive ? (isDesc ? '↓' : '↑') : '↕'}</span>
    </th>
  );
}
