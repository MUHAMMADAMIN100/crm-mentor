import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast, confirmDialog } from '../../store';
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

const REF_KEYS = [
  { key: 'ref.subscriptionStatuses', labelKey: 'admin.system.refSubStatuses' },
  { key: 'ref.subscriptionTypes', labelKey: 'admin.system.refSubTypes' },
  { key: 'ref.teacherCategories', labelKey: 'admin.system.refTeacherCategories' },
  { key: 'ref.studentTags', labelKey: 'admin.system.refStudentTags' },
  { key: 'ref.paymentSources', labelKey: 'admin.system.refPaymentSources' },
];

const SECURITY_KEYS = [
  { key: 'security.minPasswordLength', labelKey: 'admin.system.secMinPwd', type: 'number' },
  { key: 'security.lockoutOnFailedAttempts', labelKey: 'admin.system.secLockout', type: 'bool' },
  { key: 'security.maxFailedAttempts', labelKey: 'admin.system.secMaxAttempts', type: 'number' },
  { key: 'security.requireTwoFactorForAdmin', labelKey: 'admin.system.secTwoFactor', type: 'bool' },
  { key: 'security.passwordRotationDays', labelKey: 'admin.system.secPwdRotation', type: 'number' },
];

export function AdminSystem() {
  const { t } = useT();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [tab, setTab] = useState<'settings' | 'references' | 'security' | 'templates'>('settings');

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

  async function forceLogoutAll() {
    const ok = await confirmDialog({
      title: t('admin.system.confirmForceLogoutTitle'),
      body: t('admin.system.confirmForceLogoutBody'),
      okLabel: t('admin.system.forceLogout'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post('/admin/system/security/force-logout-all');
      toast.success(t('admin.system.forceLogoutDone'));
    } catch { toast.error(t('toast.error')); }
  }
  async function resetTeacherPasswords() {
    const ok = await confirmDialog({
      title: t('admin.system.confirmResetPwdTitle'),
      body: t('admin.system.confirmResetPwdBody'),
      okLabel: t('admin.system.resetPwd'),
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await api.post('/admin/system/security/reset-teacher-passwords');
      toast.success(`${t('admin.system.resetPwdDone')}: ${r.data.count}`);
    } catch { toast.error(t('toast.error')); }
  }

  if (!settings || !templates) return <Shell title={t('nav.system')}><Loading label={t('status.loading')} /></Shell>;

  return (
    <Shell title={t('nav.system')}>
      <div className="admin-toolbar">
        <button className={`btn ${tab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setTab('settings')}>{t('admin.system.tabSettings')}</button>
        <button className={`btn ${tab === 'references' ? 'btn-primary' : ''}`} onClick={() => setTab('references')}>{t('admin.system.tabReferences')}</button>
        <button className={`btn ${tab === 'security' ? 'btn-primary' : ''}`} onClick={() => setTab('security')}>{t('admin.system.tabSecurity')}</button>
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

      {tab === 'references' && (
        <div className="cards-grid">
          {REF_KEYS.map((ref) => (
            <ReferenceCard
              key={ref.key}
              title={t(ref.labelKey as any)}
              value={settings[ref.key]}
              onSave={(json) => set(ref.key, json)}
            />
          ))}
        </div>
      )}

      {tab === 'security' && (
        <div className="cards-grid">
          <div className="card">
            <h3>{t('admin.system.secPolicy')}</h3>
            {SECURITY_KEYS.map((k) => (
              <div className="field" key={k.key}>
                <label>{t(k.labelKey as any)}</label>
                {k.type === 'bool' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={settings[k.key] === 'true'} onChange={(e) => set(k.key, e.target.checked ? 'true' : 'false')} />
                    <span className="muted">{settings[k.key] === 'true' ? t('admin.system.enabled') : t('admin.system.disabled')}</span>
                  </label>
                ) : (
                  <input className="input" type={k.type === 'number' ? 'number' : 'text'} value={settings[k.key] || ''}
                    onChange={(e) => setSettings((s) => ({ ...(s || {}), [k.key]: e.target.value }))}
                    onBlur={(e) => set(k.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="card">
            <h3>{t('admin.system.secActions')}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t('admin.system.secActionsHint')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-danger" onClick={forceLogoutAll}>{t('admin.system.forceLogout')}</button>
              <button className="btn btn-danger" onClick={resetTeacherPasswords}>{t('admin.system.resetPwd')}</button>
            </div>
          </div>
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

function ReferenceCard({ title, value, onSave }: { title: string; value: string; onSave: (json: string) => void }) {
  const { t } = useT();
  let initial: string[] = [];
  try { initial = JSON.parse(value || '[]'); } catch {}
  const [items, setItems] = useState<string[]>(initial);
  const [next, setNext] = useState('');

  function add() {
    const v = next.trim();
    if (!v || items.includes(v)) return;
    const cur = [...items, v];
    setItems(cur);
    setNext('');
    onSave(JSON.stringify(cur));
  }
  function remove(item: string) {
    const cur = items.filter((x) => x !== item);
    setItems(cur);
    onSave(JSON.stringify(cur));
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {items.map((item) => (
          <span key={item} className="status-badge status-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {item}
            <button onClick={() => remove(item)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        {items.length === 0 && <span className="muted" style={{ fontSize: 12 }}>—</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" value={next} placeholder={t('admin.system.refAddPlaceholder')} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-sm btn-primary" onClick={add}>+</button>
      </div>
    </div>
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
