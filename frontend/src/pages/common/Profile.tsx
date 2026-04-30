import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { useAuth, toast } from '../../store';
import { api, invalidateApi } from '../../api';
import { useT } from '../../i18n';

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: (user as any).phone || '',
      telegram: (user as any).telegram || '',
      whatsapp: (user as any).whatsapp || '',
      instagram: (user as any).instagram || '',
      website: (user as any).website || '',
      birthDate: (user as any).birthDate ? (user as any).birthDate.slice(0, 10) : '',
      gender: (user as any).gender || '',
      city: (user as any).city || '',
      activity: (user as any).activity || '',
      category: (user as any).category || '',
      goal: (user as any).goal || '',
      bio: (user as any).bio || '',
    });
  }, [user]);

  if (!user) return null;
  const isStudent = user.role === 'STUDENT';

  function field(k: string, v: string) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true);
    setEditing(false);    // close edit mode immediately (optimistic)
    toast.success(t('profile.updated'));
    try {
      await api.post('/auth/update-profile', form);
      invalidateApi('/auth/me');
      await refreshMe();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('toast.notSaved'));
      setEditing(true);     // re-open edit on error
    } finally { setSaving(false); }
  }

  return (
    <Shell title={t('profile.title')}>
      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>{t('profile.personal')}</h3>
          {!editing ? (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>✏️ {t('profile.editBtn')}</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setEditing(false)}>{t('btn.cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? t('status.saving') : t('profile.saveBtn')}
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <ReadOnlyView form={form} role={user.role} login={user.login} />
        ) : (
          <EditForm form={form} field={field} isStudent={isStudent} role={user.role} />
        )}
      </div>
    </Shell>
  );
}

function ReadOnlyView({ form, role, login }: any) {
  const { t } = useT();
  const fields: [string, any][] = [
    [t('profile.fullName'), form.fullName],
    [t('profile.login'), login],
    [t('profile.role'), role],
    [t('profile.email'), form.email || '—'],
    [t('profile.phone'), form.phone || '—'],
    [t('profile.telegram'), form.telegram || '—'],
    [t('profile.whatsapp'), form.whatsapp || '—'],
    [t('profile.instagram'), form.instagram || '—'],
    [t('profile.website'), form.website || '—'],
    [t('profile.city'), form.city || '—'],
    [t('profile.activity'), form.activity || '—'],
  ];
  return (
    <div style={{ marginTop: 14 }}>
      {fields.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="muted">{k}</span>
          <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{String(v ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

function EditForm({ form, field, isStudent, role }: any) {
  const { t } = useT();
  return (
    <div style={{ marginTop: 14 }}>
      <div className="field"><label>{t('profile.fullName')}</label>
        <input className="input" value={form.fullName} onChange={(e) => field('fullName', e.target.value)} />
      </div>
      <div className="row">
        <div className="field"><label>{t('profile.email')}</label>
          <input className="input" type="email" value={form.email} onChange={(e) => field('email', e.target.value)} />
        </div>
        <div className="field"><label>{t('profile.phone')}</label>
          <input className="input" value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="+7 999 …" />
        </div>
      </div>
      <div className="row">
        <div className="field"><label>{t('profile.telegram')}</label>
          <input className="input" value={form.telegram} onChange={(e) => field('telegram', e.target.value)} placeholder="@username" />
        </div>
        <div className="field"><label>{t('profile.whatsapp')}</label>
          <input className="input" value={form.whatsapp} onChange={(e) => field('whatsapp', e.target.value)} placeholder="+7 999 …" />
        </div>
      </div>
      <div className="row">
        <div className="field"><label>{t('profile.instagram')}</label>
          <input className="input" value={form.instagram} onChange={(e) => field('instagram', e.target.value)} placeholder="@username" />
        </div>
        <div className="field"><label>{t('profile.website')}</label>
          <input className="input" value={form.website} onChange={(e) => field('website', e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="row">
        <div className="field"><label>{t('profile.birthDate')}</label>
          <input className="input" type="date" value={form.birthDate} onChange={(e) => field('birthDate', e.target.value)} />
        </div>
        <div className="field"><label>{t('profile.gender')}</label>
          <select className="select" value={form.gender} onChange={(e) => field('gender', e.target.value)}>
            <option value="">—</option>
            <option value="MALE">{t('profile.male')}</option>
            <option value="FEMALE">{t('profile.female')}</option>
            <option value="OTHER">{t('profile.other')}</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field"><label>{t('profile.city')}</label>
          <input className="input" value={form.city} onChange={(e) => field('city', e.target.value)} />
        </div>
        <div className="field"><label>{t('profile.activity')}</label>
          <input className="input" value={form.activity} onChange={(e) => field('activity', e.target.value)} />
        </div>
      </div>
      {role !== 'STUDENT' && (
        <div className="field"><label>{t('profile.category')}</label>
          <input className="input" value={form.category} onChange={(e) => field('category', e.target.value)} />
        </div>
      )}
      {isStudent && (
        <>
          <div className="field"><label>{t('profile.goal')}</label>
            <input className="input" value={form.goal} onChange={(e) => field('goal', e.target.value)} />
          </div>
          <div className="field"><label>{t('profile.bio')}</label>
            <textarea className="textarea" value={form.bio} onChange={(e) => field('bio', e.target.value)} placeholder={t('profile.bioPlaceholder')} />
          </div>
        </>
      )}
    </div>
  );
}
