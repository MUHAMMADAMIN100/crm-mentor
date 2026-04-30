import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { TreeView } from '../../components/Tree';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';
import { useT } from '../../i18n';

export function TeacherStudentDetails() {
  const { t } = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<any>(null);
  const [topup, setTopup] = useState({ amount: 0, comment: '' });
  const [topping, setTopping] = useState(false);

  function load() { api.get(`/students/${id}`).then((r) => setS(r.data)); }
  useEffect(load, [id]);

  async function toggleReschedule() {
    const next = !s.allowReschedule;
    setS((cur: any) => ({ ...cur, allowReschedule: next }));   // optimistic
    try {
      await api.patch(`/students/${id}`, { allowReschedule: next });
      toast.success(t('finance.settings'));
    } catch {
      setS((cur: any) => ({ ...cur, allowReschedule: !next }));
      toast.error(t('toast.notUpdated'));
    }
  }
  async function setPrice(v: number) {
    const old = s.individualPrice;
    setS((cur: any) => ({ ...cur, individualPrice: v }));   // optimistic
    try {
      await api.patch(`/students/${id}`, { individualPrice: v });
      toast.success(t('finance.priceUpdated'));
    } catch {
      setS((cur: any) => ({ ...cur, individualPrice: old }));
      toast.error(t('toast.notUpdated'));
    }
  }
  async function doTopup() {
    if (!topup.amount || topup.amount <= 0) { toast.warning(t('finance.topup.errPositive')); return; }
    const amount = topup.amount;
    const comment = topup.comment;
    setTopping(true);
    // Optimistic: bump balance and prepend payment row
    const prev = s;
    setS((cur: any) => ({
      ...cur,
      balance: (cur.balance || 0) + amount,
      payments: [{ id: `tmp-${Date.now()}`, kind: 'TOPUP', amount, comment, createdAt: new Date().toISOString() }, ...(cur.payments || [])],
    }));
    setTopup({ amount: 0, comment: '' });
    try {
      await api.post(`/finance/teacher/students/${id}/topup`, { amount, comment });
      toast.success(`${t('finance.topup.success')} +${amount}`);
      load();        // refresh in background to get the real payment row
    } catch (e: any) {
      setS(prev);
      toast.error(e?.response?.data?.message || t('finance.topup.err'));
    } finally {
      setTopping(false);
    }
  }
  async function openChat() {
    if (!s) return;
    try {
      await api.post(`/chat/private/${s.userId}`);
      nav('/teacher/messages');
    } catch { toast.error(t('chat.notOpened')); }
  }

  if (!s) return <Shell title={t('students.title')}><Loading label={t('loader.profile')} /></Shell>;
  return (
    <Shell title={s.user.fullName}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={openChat}>{t('btn.writeStudent')}</button>
      </div>
      <div className="cards-grid">
        <div className="card">
          <h3>{t('students.profile')}</h3>
          <p><span className="muted">{t('profile.email')}:</span> {s.user.email || '—'}</p>
          <p><span className="muted">{t('profile.phone')}:</span> {s.user.phone || '—'}</p>
          <p><span className="muted">{t('profile.goal')}:</span> {s.user.goal || '—'}</p>
          <p><span className="muted">{t('profile.bio')}:</span> {s.user.bio || '—'}</p>
        </div>
        <div className="card">
          <h3>{t('settings.title')}</h3>
          <div className="field">
            <label><input type="checkbox" checked={s.allowReschedule} onChange={toggleReschedule} /> {t('students.allowReschedule2')}</label>
          </div>
          <div className="field">
            <label>{t('students.individualPrice')}</label>
            <input className="input" type="number" defaultValue={s.individualPrice || 0} onBlur={(e) => setPrice(+e.target.value)} />
          </div>
        </div>
        <div className="card">
          <h3>{t('students.tree')}</h3>
          <TreeView tree={s.tree} />
        </div>
        <div className="card">
          <h3>{t('students.balanceTitle')} <span style={{ color: s.balance < 0 ? 'var(--danger)' : 'var(--primary)' }}>{s.balance}</span></h3>
          <div className="row">
            <input className="input" type="number" placeholder={t('teachers.amount')} value={topup.amount || ''} onChange={(e) => setTopup({ ...topup, amount: +e.target.value })} />
            <input className="input" placeholder={t('calendar.comment')} value={topup.comment} onChange={(e) => setTopup({ ...topup, comment: e.target.value })} />
            <button className="btn btn-primary" onClick={doTopup} disabled={topping}>{topping ? '…' : t('btn.topup')}</button>
          </div>
          <div className="h-divider" />
          <h3>{t('students.history')}</h3>
          <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {s.payments.map((p: any) => (
              <div key={p.id} className="list-item">
                <div>{p.kind === 'TOPUP' ? '+ ' : p.kind === 'CHARGE' ? '− ' : ''}{p.amount}</div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(p.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>{t('students.courseAccess')}</h3>
          <div className="list">
            {s.courseAccesses.map((a: any) => (
              <div key={a.id} className="list-item">
                <div>{a.course.title}</div>
                <div className="muted">{a.expiresAt ? `${t('course.untilDate')} ${new Date(a.expiresAt).toLocaleDateString()}` : t('course.indef')}</div>
              </div>
            ))}
            {s.courseAccesses.length === 0 && <div className="empty">{t('empty.noAccesses')}</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
