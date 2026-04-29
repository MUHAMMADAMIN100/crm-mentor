import { useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Loading } from '../../components/Loading';
import { api } from '../../api';

export function NotesPage() {
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
    <Shell title="Заметки">
      {body === null ? (
        <Loading label="Открываем ваши заметки…" />
      ) : (
        <div className="card notes-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Личные заметки
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              {saving ? 'сохраняем…' : savedAt ? `сохранено в ${savedAt}` : 'автосохранение'}
            </span>
          </h3>
          <textarea
            className="textarea notes-textarea"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Здесь можно записывать всё что нужно — план занятий, идеи, дела, контакты…"
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'right' }}>
            {body.length}/1000 символов
          </div>
        </div>
      )}
    </Shell>
  );
}
