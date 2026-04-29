import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { TreeView } from '../../components/Tree';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';

export function TeacherStudentDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<any>(null);
  const [topup, setTopup] = useState({ amount: 0, comment: '' });
  const [topping, setTopping] = useState(false);

  function load() { api.get(`/students/${id}`).then((r) => setS(r.data)); }
  useEffect(load, [id]);

  async function toggleReschedule() {
    try {
      await api.patch(`/students/${id}`, { allowReschedule: !s.allowReschedule });
      toast.success('Настройка обновлена');
      load();
    } catch { toast.error('Не удалось обновить'); }
  }
  async function setPrice(v: number) {
    try {
      await api.patch(`/students/${id}`, { individualPrice: v });
      toast.success('Цена обновлена');
      load();
    } catch { toast.error('Не удалось обновить'); }
  }
  async function doTopup() {
    if (!topup.amount || topup.amount <= 0) { toast.warning('Сумма должна быть положительной'); return; }
    setTopping(true);
    try {
      await api.post(`/finance/teacher/students/${id}/topup`, topup);
      toast.success(`Баланс пополнен на ${topup.amount}`);
      setTopup({ amount: 0, comment: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ошибка пополнения');
    } finally {
      setTopping(false);
    }
  }
  async function openChat() {
    if (!s) return;
    try {
      await api.post(`/chat/private/${s.userId}`);
      nav('/teacher/messages');
    } catch { toast.error('Не удалось открыть чат'); }
  }

  if (!s) return <Shell title="Ученик"><Loading label="Загружаем профиль…" /></Shell>;
  return (
    <Shell title={s.user.fullName}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={openChat}>✉️ Написать ученику</button>
      </div>
      <div className="cards-grid">
        <div className="card">
          <h3>Профиль</h3>
          <p><span className="muted">Email:</span> {s.user.email || '—'}</p>
          <p><span className="muted">Телефон:</span> {s.user.phone || '—'}</p>
          <p><span className="muted">Цель:</span> {s.user.goal || '—'}</p>
          <p><span className="muted">О себе:</span> {s.user.bio || '—'}</p>
        </div>
        <div className="card">
          <h3>Настройки</h3>
          <div className="field">
            <label><input type="checkbox" checked={s.allowReschedule} onChange={toggleReschedule} /> Разрешить переносы</label>
          </div>
          <div className="field">
            <label>Стоимость занятия</label>
            <input className="input" type="number" defaultValue={s.individualPrice || 0} onBlur={(e) => setPrice(+e.target.value)} />
          </div>
        </div>
        <div className="card">
          <h3>Дерево мотивации</h3>
          <TreeView tree={s.tree} />
        </div>
        <div className="card">
          <h3>Баланс: <span style={{ color: s.balance < 0 ? 'var(--danger)' : 'var(--primary)' }}>{s.balance}</span></h3>
          <div className="row">
            <input className="input" type="number" placeholder="Сумма" value={topup.amount || ''} onChange={(e) => setTopup({ ...topup, amount: +e.target.value })} />
            <input className="input" placeholder="Комментарий" value={topup.comment} onChange={(e) => setTopup({ ...topup, comment: e.target.value })} />
            <button className="btn btn-primary" onClick={doTopup} disabled={topping}>{topping ? '…' : 'Пополнить'}</button>
          </div>
          <div className="h-divider" />
          <h3>История</h3>
          <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {s.payments.map((p: any) => (
              <div key={p.id} className="list-item">
                <div>{p.kind === 'TOPUP' ? '+ ' : p.kind === 'CHARGE' ? '− ' : ''}{p.amount}</div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(p.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Доступ к курсам</h3>
          <div className="list">
            {s.courseAccesses.map((a: any) => (
              <div key={a.id} className="list-item">
                <div>{a.course.title}</div>
                <div className="muted">{a.expiresAt ? `до ${new Date(a.expiresAt).toLocaleDateString('ru-RU')}` : 'бессрочно'}</div>
              </div>
            ))}
            {s.courseAccesses.length === 0 && <div className="empty">Нет доступов</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
