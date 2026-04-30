import { Shell } from '../../components/Shell';
import { ChatPanel } from '../../components/Chat';
import { useT } from '../../i18n';

export function TeacherMessages() {
  const { t } = useT();
  return (
    <Shell title={t('chat.title')}>
      <ChatPanel />
    </Shell>
  );
}
