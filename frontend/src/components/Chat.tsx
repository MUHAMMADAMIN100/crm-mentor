import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../store';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
function getSocket() {
  if (socket) return socket;
  const token = localStorage.getItem('miz_token');
  socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', { auth: { token } });
  return socket;
}

export function ChatPanel() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  function loadChats() { api.get('/chat').then((r) => setChats(r.data)); }
  useEffect(loadChats, []);

  useEffect(() => {
    if (!active) return;
    api.get(`/chat/${active}/messages`).then((r) => setMessages(r.data));
    const s = getSocket();
    s.emit('chat:join', active);
    const handler = (m: any) => { if (m.chatId === active) setMessages((prev) => [...prev, m]); };
    s.on('chat:message', handler);
    return () => { s.off('chat:message', handler); };
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9 });
  }, [messages]);

  async function send() {
    if (!text.trim() || !active) return;
    const s = getSocket();
    s.emit('chat:send', { chatId: active, text });
    setText('');
  }

  async function openSupport() {
    const r = await api.get('/chat/support');
    loadChats();
    setActive(r.data.id);
  }

  return (
    <div className="chat-shell">
      <div className="chat-list">
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={openSupport}>Чат Miz Support</button>
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
            <div className="chat-messages" ref={scrollRef}>
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.senderId === user?.id ? 'mine' : ''}`}>
                  {m.senderId !== user?.id && <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{m.sender?.fullName}</div>}
                  {m.text}
                </div>
              ))}
              {messages.length === 0 && <div className="empty">Сообщений нет</div>}
            </div>
            <div className="chat-input">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Сообщение…" />
              <button className="btn btn-primary" onClick={send}>Отправить</button>
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: 'auto' }}>Выберите чат</div>
        )}
      </div>
    </div>
  );
}
