import { useUI } from '../store';

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const remove = useUI((s) => s.removeToast);
  return (
    <div className="toast-stack" role="region" aria-live="polite" aria-label="Уведомления">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <div className="toast-icon">{iconFor(t.kind)}</div>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div>{t.body}</div>
          </div>
          <button className="toast-close" aria-label="Закрыть" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function iconFor(kind: string) {
  if (kind === 'success') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  if (kind === 'error') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  );
  if (kind === 'warning') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
  );
}
