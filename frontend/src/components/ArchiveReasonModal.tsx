import { useState } from 'react';
import { Modal } from './Modal';
import { useT } from '../i18n';

const QUICK_REASONS = ['inactive', 'requested_deletion', 'unpaid', 'duplicate', 'other'];

/**
 * Two-step destructive action modal: forces the admin to record WHY they
 * archive/delete an account. Stores the reason in audit log + user.archiveReason.
 */
export function ArchiveReasonModal({
  open, danger, title, body, okLabel, onCancel, onConfirm,
}: {
  open: boolean;
  danger?: boolean;
  title: string;
  body?: string;
  okLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useT();
  const [picked, setPicked] = useState('inactive');
  const [other, setOther] = useState('');
  if (!open) return null;
  const reason = picked === 'other' ? other.trim() : picked;
  const ok = reason.length > 0;
  function submit() {
    if (!ok) return;
    onConfirm(reason);
  }
  return (
    <Modal open onClose={onCancel} title={title} width={460}
      footer={
        <>
          <button className="btn" onClick={onCancel}>{t('btn.cancel')}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={!ok}>{okLabel}</button>
        </>
      }>
      {body && <p className="muted" style={{ marginTop: 0 }}>{body}</p>}
      <div className="field"><label>{t('archiveReason.label')}</label></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {QUICK_REASONS.map((r) => (
          <label key={r} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 4px', cursor: 'pointer' }}>
            <input type="radio" name="reason" checked={picked === r} onChange={() => setPicked(r)} />
            <span>{t(`archiveReason.${r}` as any)}</span>
          </label>
        ))}
      </div>
      {picked === 'other' && (
        <div className="field" style={{ marginTop: 8 }}>
          <input className="input" autoFocus placeholder={t('archiveReason.placeholder')} value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
