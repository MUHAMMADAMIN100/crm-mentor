import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { toast } from '../../store';
import { useT, useI18n, LANG_OPTIONS, Lang } from '../../i18n';

export function SettingsPage() {
  const { t } = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Optimistic UX: clear fields and pre-show success — rollback on error
    const o = oldP, n = newP;
    setOld(''); setNew('');
    toast.success(t('auth.passwordUpdated'));
    try {
      await api.post('/auth/change-password', { oldPassword: o, newPassword: n });
    } catch (e: any) {
      // Restore fields and show actual error
      setOld(o); setNew(n);
      toast.error(e?.response?.data?.message || t('toast.error'));
    } finally { setSaving(false); }
  }

  return (
    <Shell title={t('settings.title')}>
      <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <h3>{t('settings.language')}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LANG_OPTIONS.map((opt) => (
            <button key={opt.code}
              className={`btn ${lang === opt.code ? 'btn-primary' : ''}`}
              onClick={() => setLang(opt.code as Lang)}>
              {opt.flag} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3>{t('settings.changePassword')}</h3>
        <form onSubmit={submit}>
          <div className="field"><label>{t('auth.passwordOld')}</label><input className="input" type="password" value={oldP} onChange={(e) => setOld(e.target.value)} required /></div>
          <div className="field"><label>{t('auth.passwordNew')}</label><input className="input" type="password" value={newP} onChange={(e) => setNew(e.target.value)} required minLength={6} /></div>
          <button className="btn btn-primary" disabled={saving}>{saving ? t('status.saving') : t('btn.save')}</button>
        </form>
      </div>
    </Shell>
  );
}
