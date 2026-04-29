import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

/**
 * Inline auto-saving notes widget. Used on home pages of all roles.
 * Backend endpoint: GET/PUT /notes (per-user, max 1000 chars).
 */
export function NotesCard({ minHeight = 160 }: { minHeight?: number }) {
  const [body, setBody] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const firstLoad = useRef(true);

  useEffect(() => {
    api.get('/notes').then((r) => setBody(r.data?.body ?? '')).catch(() => setBody(''));
  }, []);

  useEffect(() => {
    if (body === null) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put('/notes', { body });
        setSavedAt(new Date().toLocaleTimeString('ru-RU'));
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [body]);

  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Заметки
        </span>
        <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
          {body === null ? 'открываем…' : saving ? 'сохраняем…' : savedAt ? `сохр. в ${savedAt}` : 'автосохранение'}
        </span>
      </h3>
      <textarea
        className="textarea"
        maxLength={1000}
        value={body ?? ''}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Записывайте идеи, планы, важные мысли…"
        disabled={body === null}
        style={{ minHeight }}
      />
      <div className="muted" style={{ fontSize: 11, marginTop: 4, textAlign: 'right' }}>
        {(body ?? '').length}/1000
      </div>
    </div>
  );
}
