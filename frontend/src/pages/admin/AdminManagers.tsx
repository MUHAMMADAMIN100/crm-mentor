import { Shell } from '../../components/Shell';
import { useT } from '../../i18n';

export function AdminManagers() {
  const { t } = useT();
  return (
    <Shell title={t('nav.managers')}>
      <div className="card">
        <h3>{t('nav.managers')}</h3>
        <p className="muted">—</p>
      </div>
    </Shell>
  );
}
