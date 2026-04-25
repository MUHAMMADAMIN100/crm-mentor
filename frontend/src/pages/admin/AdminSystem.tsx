import { Shell } from '../../components/Shell';

export function AdminSystem() {
  return (
    <Shell title="Система">
      <div className="card">
        <h3>Состояние системы</h3>
        <p className="muted">Здесь будут параметры платформы, бэкапы и системные настройки.</p>
      </div>
    </Shell>
  );
}
