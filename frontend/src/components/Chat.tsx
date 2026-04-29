import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth, toast } from '../store';
import { io, Socket } from 'socket.io-client';

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
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [opening, setOpening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(() => {
    return api.get('/chat').then((r) => setChats(r.data)).catch(() => toast.error('Не удалось загрузить чаты'));
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Auto-open one-click chat with teacher/student
  useEffect(() => {
    if (!autoOpenWithUserId || !user || opening) return;
    setOpening(true);
    api.post(`/chat/private/${autoOpenWithUserId}`)
      .then(async (r) => {
        await loadChats();
        setActive(r.data.id);
      })
      .catch(() => toast.error('Не удалось открыть чат'))
      .finally(() => setOpening(false));
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
    api.get(`/chat/${active}/messages`).then((r) => setMessages(r.data)).catch(() => toast.error('Не удалось загрузить сообщения'));
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
    } catch { toast.error('Не удалось открыть чат поддержки'); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className={`chat-shell ${active ? 'has-active' : 'no-active'}`}>
      <div className="chat-list">
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={openSupport}>💬 Чат Miz Support</button>
        </div>
        {chats.map((c) => {
          const other = c.members.find((m: any) => m.userId !== user?.id);
          const title = c.title || other?.user?.fullName || 'Чат';
          const last = c.messages[0];
          return (
            <div key={c.id} className={`chat-list-item ${active === c.id ? 'active' : ''}`} onClick={() => setActive(c.id)}>
              <div style={{ fontWeight: 500 }}>{title}</div>
              <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {last?.text || (last ? '[вложение]' : 'нет сообщений')}
              </div>
            </div>
          );
        })}
        {chats.length === 0 && <div className="empty">Нет чатов</div>}
      </div>

      <div className="chat-pane">
        {active ? (
          <>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
              <button className="chat-back" onClick={() => setActive(null)} aria-label="К списку чатов">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div style={{ fontWeight: 600 }}>
                {(() => {
                  const c = chats.find((x) => x.id === active);
                  if (!c) return '';
                  const other = c.members.find((m: any) => m.userId !== user?.id);
                  return c.title || other?.user?.fullName || 'Чат';
                })()}
              </div>
            </div>
            <div className="chat-messages" ref={scrollRef}>
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.senderId === user?.id ? 'mine' : ''} ${m.__optimistic ? 'sending' : ''}`}>
                  {m.senderId !== user?.id && <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{m.sender?.fullName}</div>}
                  <div>{m.text}</div>
                  <div className="chat-msg-meta">
                    {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {m.__optimistic && ' · отправляется…'}
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div className="empty">Сообщений нет</div>}
            </div>
            <div className="chat-input">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)"
                rows={1}
              />
              <button className="btn btn-primary" onClick={send} disabled={!text.trim()}>
                Отправить
              </button>
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: 'auto' }}>
            {opening ? 'Открываем чат…' : 'Выберите чат'}
          </div>
        )}
      </div>
    </div>
  );
}
