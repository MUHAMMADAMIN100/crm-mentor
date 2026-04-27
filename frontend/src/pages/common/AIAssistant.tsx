import { useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { useAuth } from '../../store';
import '../../styles/ai.css';

interface Message { role: 'user' | 'assistant'; content: string; }

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Доступ администратора',
  TEACHER: 'Доступ учителя',
  STUDENT: 'Доступ ученика',
};

export function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [model, setModel] = useState<string>('Gemini 2.0 Flash');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/ai/suggestions').then((r) => setSuggestions(r.data.items));
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    const next: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await api.post('/ai/ask', { question, history: messages });
      setMessages([...next, { role: 'assistant', content: r.data.answer }]);
      if (r.data.model && r.data.model !== 'fallback') setModel(prettyModel(r.data.model));
    } catch (e: any) {
      const detail = e?.response?.data?.message || e?.message || 'неизвестная ошибка';
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
      setMessages([...next, { role: 'assistant', content: `Не удалось получить ответ${status}: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <Shell title="ИИ-помощник">
      <div className="ai-shell">
        <div className="ai-header">
          <div className="ai-avatar">
            <BotIcon />
          </div>
          <div>
            <div className="ai-title">ИИ-помощник</div>
            <div className="ai-subtitle">Анализирует данные CRM в реальном времени · {ROLE_LABEL[user?.role || 'STUDENT']}</div>
          </div>
          <div className="ai-model-pill"><span className="dot" /> {model}</div>
        </div>

        <div className="ai-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="ai-empty">
              <div className="big-bot"><BotIcon /></div>
              <h2>Задайте вопрос</h2>
              <p>
                Я анализирую базу данных Miz и отвечаю на ваши вопросы о
                {user?.role === 'ADMIN' && ' учителях, учениках, курсах, финансах и эффективности платформы.'}
                {user?.role === 'TEACHER' && ' ваших учениках, курсах, расписании, домашках и финансах.'}
                {user?.role === 'STUDENT' && ' ваших курсах, прогрессе, расписании и балансе.'}
              </p>
              <div className="ai-suggestions">
                {suggestions.map((s) => (
                  <button key={s} className="ai-suggest" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : ''}`}>
              <div className="mini-avatar">
                {m.role === 'user' ? (user?.fullName?.[0]?.toUpperCase() || 'U') : <BotIcon />}
              </div>
              <div className="bubble">{m.content}</div>
            </div>
          ))}

          {loading && (
            <div className="ai-msg">
              <div className="mini-avatar"><BotIcon /></div>
              <div className="bubble" style={{ padding: 0 }}>
                <div className="ai-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-input-bar">
          <textarea
            className="ai-input"
            placeholder="Задайте вопрос о ваших данных…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button className="ai-send" disabled={!input.trim() || loading} onClick={() => send(input)} title="Отправить">
            <SendIcon />
          </button>
        </div>
        <div className="ai-disclaimer">
          ИИ анализирует актуальные данные из вашей роли. Ответы могут быть неточными.
        </div>
      </div>
    </Shell>
  );
}

function prettyModel(m: string) {
  if (!m) return 'AI';
  if (m.startsWith('gemini/')) {
    const name = m.replace('gemini/', '');
    if (name.includes('2.0-flash')) return 'Gemini 2.0 Flash';
    if (name.includes('1.5-flash')) return 'Gemini 1.5 Flash';
    if (name.includes('1.5-pro')) return 'Gemini 1.5 Pro';
    return name;
  }
  const map: Record<string, string> = {
    'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
    'llama-3.1-70b-versatile': 'Llama 3.1 70B',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B',
    'mixtral-8x7b-32768': 'Mixtral 8x7B',
  };
  return map[m] || m;
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="M12 2v6" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
      <path d="M9 18h6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
