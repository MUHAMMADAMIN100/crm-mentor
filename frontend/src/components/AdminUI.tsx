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
