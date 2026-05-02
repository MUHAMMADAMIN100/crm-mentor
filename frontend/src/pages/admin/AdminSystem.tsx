import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';
import { useT } from '../../i18n';

const SETTING_GROUPS: { title: string; keys: { key: string; label: string; type?: string; options?: string[] }[] }[] = [
  {
    title: 'admin.system.platform',
    keys: [
      { key: 'platform.name', label: 'admin.system.platformName' },
      { key: 'platform.logoUrl', label: 'admin.system.platformLogo' },
      { key: 'default.lang', label: 'admin.system.defaultLang', type: 'select', options: ['ru', 'en', 'tr'] },
      { key: 'default.timezone', label: 'admin.system.timezone' },
      { key: 'default.currency', label: 'admin.system.currency', type: 'select', options: ['RUB', 'USD', 'EUR', 'KZT', 'UZS'] },
      { key: 'default.dateFormat', label: 'admin.system.dateFormat', type: 'select', options: ['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] },
    ],
  },
  {
    title: 'admin.system.features',
    keys: [
      { key: 'feature.ai', label: 'admin.system.featAi', type: 'bool' },
      { key: 'feature.marketplace', label: 'admin.system.featMarketplace', type: 'bool' },
      { key: 'feature.schools', label: 'admin.system.featSchools', type: 'bool' },
      { key: 'feature.managers', label: 'admin.system.featManagers', type: 'bool' },
    ],
  },
];

export function AdminSystem() {
  const { t } = useT();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [tab, setTab] = useState<'settings' | 'templates'>('settings');

  useEffect(() => {
    api.get('/admin/system/settings').then((r) => setSettings(r.data));
    api.get('/admin/system/templates').then((r) => setTemplates(r.data));
  }, []);

  function set(key: string, value: string) {
    setSettings((s) => ({ ...(s || {}), [key]: value }));
    api.patch('/admin/system/settings', { [key]: value })
      .then(() => toast.success(t('admin.system.saved')))
      .catch(() => toast.error(t('toast.notSaved')));
  }

  if (!settings || !templates) return <Shell title={t('nav.system')}><Loading label={t('status.loading')} /></Shell>;

  return (
    <Shell title={t('nav.system')}>
      <div className="admin-toolbar">
        <button className={`btn ${tab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setTab('settings')}>{t('admin.system.tabSettings')}</button>
        <button className={`btn ${tab === 'templates' ? 'btn-primary' : ''}`} onClick={() => setTab('templates')}>{t('admin.system.tabTemplates')}</button>
      </div>

      {tab === 'settings' && (
        <div className="cards-grid">
          {SETTING_GROUPS.map((g) => (
            <div key={g.title} className="card">
              <h3>{t(g.title as any)}</h3>
              {g.keys.map((k) => (
                <div className="field" key={k.key}>
                  <label>{t(k.label as any)}</label>
                  {k.type === 'select' ? (
                    <select className="select" value={settings[k.key] || ''} onChange={(e) => set(k.key, e.target.value)}>
                      {(k.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : k.type === 'bool' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={settings[k.key] === 'true'} onChange={(e) => set(k.key, e.target.checked ? 'true' : 'false')} />
                      <span className="muted">{settings[k.key] === 'true' ? t('admin.system.enabled') : t('admin.system.disabled')}</span>
                    </label>
                  ) : (
                    <input className="input" value={settings[k.key] || ''}
                      onChange={(e) => setSettings((s) => ({ ...(s || {}), [k.key]: e.target.value }))}
                      onBlur={(e) => set(k.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'templates' && (
        <div className="cards-grid">
          {templates.map((tmpl) => <TemplateCard key={tmpl.id} template={tmpl} onSaved={(next) => setTemplates((cur) => (cur || []).map((x) => x.id === next.id ? next : x))} />)}
        </div>
      )}
    </Shell>
  );
}

function TemplateCard({ template, onSaved }: any) {
  const { t } = useT();
  const [form, setForm] = useState({ title: template.title, body: template.body, enabled: template.enabled });
  function up(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function save() {
    onSaved({ ...template, ...form });
    api.patch(`/admin/system/templates/${template.id}`, form)
      .then(() => toast.success(t('admin.system.saved')))
      .catch(() => toast.error(t('toast.notSaved')));
  }
  return (
    <div className="card">
      <div className="flex" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{template.code}</h3>
        <div className="spacer" />
        <label className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => up('enabled', e.target.checked)} />
          {form.enabled ? t('admin.system.enabled') : t('admin.system.disabled')}
        </label>
      </div>
      <div className="field"><label>{t('notif.title')}</label><input className="input" value={form.title} onChange={(e) => up('title', e.target.value)} /></div>
      <div className="field"><label>{t('notif.message')}</label><textarea className="textarea" value={form.body} onChange={(e) => up('body', e.target.value)} /></div>
      <div style={{ textAlign: 'right' }}><button className="btn btn-primary btn-sm" onClick={save}>{t('btn.save')}</button></div>
    </div>
  );
}
