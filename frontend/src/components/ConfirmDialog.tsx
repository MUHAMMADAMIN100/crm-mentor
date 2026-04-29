import { useEffect } from 'react';
import { useUI } from '../store';

export function ConfirmHost() {
  const confirms = useUI((s) => s.confirms);
  const resolve = useUI((s) => s.resolveConfirm);
  const top = confirms[confirms.length - 1];

  useEffect(() => {
    if (!top) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') resolve(top.id, false);
      if (e.key === 'Enter') resolve(top.id, true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, resolve]);

  if (!top) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={() => resolve(top.id, false)}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-icon ${top.danger ? 'danger' : ''}`}>
          {top.danger ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          )}
        </div>
        <h3 id="confirm-title">{top.title}</h3>
        {top.body && <p className="confirm-body">{top.body}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => resolve(top.id, false)}>{top.cancelLabel || 'Отмена'}</button>
          <button
            className={top.danger ? 'btn btn-danger' : 'btn btn-primary'}
            autoFocus
            onClick={() => resolve(top.id, true)}
          >{top.okLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
