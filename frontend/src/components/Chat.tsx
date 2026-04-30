import { useEffect, useRef, useState, useCallback } from 'react';
import { api, getCached, setCached } from '../api';
import { useAuth, toast } from '../store';
import { io, Socket } from 'socket.io-client';
import { useT } from '../i18n';

let socket: Socket | null = null;
let socketUserId: string | null = null;

function getSocket(userId: string): Socket {
  if (socket && socketUserId === userId) return socket;
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
  const token = localStorage.getItem('miz_token');
  socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionAttempts: Infinity,
  });
  socketUserId = userId;
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
    socketUserId = null;
  }
}

interface Props {
  /** Auto-open chat with this userId (counterparty) — used for student↔teacher one-click. */
  autoOpenWithUserId?: string;
}

export function ChatPanel({ autoOpenWithUserId }: Props = {}) {
  const { t } = useT();
  const { user } = useAuth();
  // Show cached chats instantly on revisit (SWR-style) — no spinner.
  const [chats, setChats] = useState<any[]>(() => (getCached<any[]>('/chat') || []));
  const [chatsLoading, setChatsLoading] = useState<boolean>(() => !getCached<any[]>('/chat'));
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(() => {
    return api.get('/chat')
      .then((r) => { setChats(r.data); setCached('/chat', undefined, r.data); })
      .catch(() => { /* silent first try; toast only on persistent failure */ })
      .finally(() => setChatsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Auto-open one-click chat with teacher/student
  useEffect(() => {
    if (!autoOpenWithUserId || !user) return;
    api.post(`/chat/private/${autoOpenWithUserId}`)
      .then(async (r) => {
        await loadChats();
        setActive(r.data.id);
      })
      .catch(() => toast.error(t('chat.notOpened')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenWithUserId, user]);

  // Subscribe to socket once user is available; messages handler routes per-active-chat.
  useEffect(() => {
    if (!user) return;
    const s = getSocket(user.id);
    function onMessage(m: any) {
      // update list (last message preview) regardless of active chat
      setChats((prev) => prev.map((c) => c.id === m.chatId ? { ...c, messages: [m, ...(c.messages || [])].slice(0, 1) } : c));
      setMessages((prev) => {
        if (m.chatId !== active) return prev;
        // replace optimistic temp by id-match (clientId), or skip duplicate by id
        const tempIdx = prev.findIndex((x) => x.__optimistic && x.text === m.text && x.senderId === m.senderId);
        if (tempIdx >= 0) {
          const next = [...prev];
          next[tempIdx] = m;
          return next;
        }
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    }
    s.on('chat:message', onMessage);
    return () => { s.off('chat:message', onMessage); };
  }, [user, active]);

  // Load messages + join room when active changes
  useEffect(() => {
    if (!active || !user) return;
    // Instant render from cache if we have it, then revalidate.
    const cached = getCached<any[]>(`/chat/${active}/messages`);
    if (cached) setMessages(cached);
    setMessagesLoading(!cached);
    api.get(`/chat/${active}/messages`)
      .then((r) => { setMessages(r.data); setCached(`/chat/${active}/messages`, undefined, r.data); })
      .catch(() => toast.error(t('chat.notLoadedMessages')))
      .finally(() => setMessagesLoading(false));
    const s = getSocket(user.id);
    s.emit('chat:join', active);
  }, [active, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!text.trim() || !active || !user) return;
    const body = text;
    setText('');
    // optimistic message
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      chatId: active,
      senderId: user.id,
      sender: { id: user.id, fullName: user.fullName },
      text: body,
      kind: 'TEXT',
      createdAt: new Date().toISOString(),
      __optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    const s = getSocket(user.id);
    s.emit('chat:send', { chatId: active, text: body }, (ack: any) => {
      // ack from server with the saved message — replace tmp
      if (ack && ack.id) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? ack : m));
      }
    });
  }

  async function openSupport() {
    try {
      const r = await api.get('/chat/support');
      await loadChats();
      setActive(r.data.id);
    } catch { toast.error(t('chat.notOpenedSupport')); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className={`chat-shell ${active ? 'has-active' : 'no-active'}`}>
      <div className="chat-list">
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={openSupport}>{t('btn.support')}</button>
        </div>
        {chatsLoading && chats.length === 0 ? (
          <div style={{ padding: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 10, width: '85%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {chats.map((c) => {
              const other = c.members.find((m: any) => m.userId !== user?.id);
              const title = c.title || other?.user?.fullName || t('chat.title');
              const last = c.messages[0];
              return (
                <div key={c.id} className={`chat-list-item ${active === c.id ? 'active' : ''}`} onClick={() => setActive(c.id)}>
                  <div style={{ fontWeight: 500 }}>{title}</div>
                  <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last?.text || (last ? t('chat.attachment') : t('chat.noMessages'))}
                  </div>
                </div>
              );
            })}
            {chats.length === 0 && <div className="empty">{t('empty.noChats')}</div>}
          </>
        )}
      </div>

      <div className="chat-pane">
        {active ? (
          <>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
              <button className="chat-back" onClick={() => setActive(null)} aria-label={t('btn.back')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div style={{ fontWeight: 600 }}>
                {(() => {
                  const c = chats.find((x) => x.id === active);
                  if (!c) return '';
                  const other = c.members.find((m: any) => m.userId !== user?.id);
                  return c.title || other?.user?.fullName || t('chat.title');
                })()}
              </div>
            </div>
            <div className="chat-messages" ref={scrollRef}>
              {messagesLoading && messages.length === 0 && (
                <div style={{ padding: 8 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 36, width: i === 1 ? '70%' : '55%', marginBottom: 10, alignSelf: i === 1 ? 'flex-end' : 'flex-start' }} />
                  ))}
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.senderId === user?.id ? 'mine' : ''} ${m.__optimistic ? 'sending' : ''}`}>
                  {m.senderId !== user?.id && <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{m.sender?.fullName}</div>}
                  <div>{m.text}</div>
                  <div className="chat-msg-meta">
                    {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {m.__optimistic && ` · ${t('chat.sending')}`}
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div className="empty">{t('empty.noMessages')}</div>}
            </div>
            <div className="chat-input">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
              />
              <button className="btn btn-primary" onClick={send} disabled={!text.trim()}>
                {t('btn.send')}
              </button>
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: 'auto' }}>
            {t('empty.selectChat')}
          </div>
        )}
      </div>
    </div>
  );
}
