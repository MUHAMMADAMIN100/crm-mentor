import { useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Loading } from '../../components/Loading';
import { api } from '../../api';
import { useT } from '../../i18n';

export function NotesPage() {
  const { t } = useT();
  const [body, setBody] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const firstLoad = useRef(true);

  useEffect(() => {
    api.get('/notes').then((r) => setBody(r.data?.body ?? ''));
  }, []);

  useEffect(() => {
    if (body === null) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    const tt = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put('/notes', { body });
        setSavedAt(new Date().toLocaleTimeString());
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => clearTimeout(tt);
  }, [body]);

  return (
    <Shell title={t('notes.title')}>
      {body === null ? (
        <Loading label={t('notes.openingFor')} />
      ) : (
        <div className="card notes-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {t('notes.personal')}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              {saving ? t('status.saving') : savedAt ? `${t('status.savedAt')} ${savedAt}` : t('status.autosave')}
            </span>
          </h3>
          <textarea
            className="textarea notes-textarea"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('notes.placeholder')}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'right' }}>
            {body.length}/1000
          </div>
        </div>
      )}
    </Shell>
  );
}
