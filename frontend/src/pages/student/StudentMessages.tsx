import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { ChatPanel } from '../../components/Chat';
import { api } from '../../api';
import { useAuth, toast } from '../../store';
import { useT } from '../../i18n';

export function StudentMessages() {
  const { t } = useT();
  const { user } = useAuth();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState<string | undefined>();

  useEffect(() => {
    const tId = (user as any)?.studentProfile?.teacherId;
    if (tId) setTeacherId(tId);
    else {
      api.get('/students/me/dashboard').then((r) => {
        setTeacherId(r.data?.profile?.teacherId || null);
      }).catch(() => {});
    }
  }, [user]);

  function openWithTeacher() {
    if (!teacherId) {
      toast.warning(t('chat.cantFindTeacher'));
      return;
    }
    setAutoOpen(teacherId);
  }

  return (
    <Shell title={t('chat.title')}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={openWithTeacher} disabled={!teacherId}>
          {t('btn.writeTeacher')}
        </button>
      </div>
      <ChatPanel autoOpenWithUserId={autoOpen} />
    </Shell>
  );
}
