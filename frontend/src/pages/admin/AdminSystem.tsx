import { Shell } from '../../components/Shell';
import { useT } from '../../i18n';

export function AdminSystem() {
  const { t } = useT();
  return (
    <Shell title={t('nav.system')}>
      <div className="card">
        <h3>{t('nav.system')}</h3>
        <p className="muted">—</p>
      </div>
    </Shell>
  );
}
