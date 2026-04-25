import { Shell } from '../../components/Shell';
import { useAuth } from '../../store';

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  const fields: [string, any][] = [
    ['ФИО', user.fullName],
    ['Логин', user.login],
    ['Роль', user.role],
    ['Email', user.email || '—'],
    ['Телефон', (user as any).phone || '—'],
    ['Telegram', (user as any).telegram || '—'],
    ['Город', (user as any).city || '—'],
    ['Деятельность', (user as any).activity || '—'],
  ];
  return (
    <Shell title="Профиль">
      <div className="card" style={{ maxWidth: 600 }}>
        <h3>Личные данные</h3>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted">{k}</span><span>{String(v ?? '—')}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
