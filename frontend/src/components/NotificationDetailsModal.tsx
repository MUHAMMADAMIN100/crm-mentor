import { Modal } from './Modal';
import { useT } from '../i18n';

export function NotificationDetailsModal({ notif, onClose }: { notif: any; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal open onClose={onClose} title={t('notif.detailsTitle')} width={520}
      footer={<button className="btn btn-primary" onClick={onClose}>{t('btn.cancel')}</button>}>
      <div className="notif-detail-row">
        <span className="label">{t('notif.title')}</span>
        <span className="value" style={{ fontWeight: 500 }}>{notif.title}</span>
      </div>
      {notif.body && (
        <div className="notif-detail-row">
          <span className="label">{t('notif.message')}</span>
          <span className="value" style={{ whiteSpace: 'pre-wrap' }}>{notif.body}</span>
        </div>
      )}
      <div className="notif-detail-row">
        <span className="label">{t('notif.date')}</span>
        <span className="value">{new Date(notif.createdAt).toLocaleString()}</span>
      </div>
      <div className="notif-detail-row">
        <span className="label">{t('notif.status')}</span>
        <span className="value">
          <span className={`badge badge-${notif.read ? 'success' : 'warning'}`}>
            {notif.read ? t('notif.read') : t('notif.unread')}
          </span>
        </span>
      </div>
    </Modal>
  );
}
