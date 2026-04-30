import { useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { useAuth, useAi, toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';
import '../../styles/ai.css';

export function AIAssistantPage() {
  const { t } = useT();
  const { user } = useAuth();
  const { messages, model, setMessages, setModel, clear } = useAi();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/ai/suggestions').then((r) => setSuggestions(r.data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await api.post('/ai/ask', { question, history: messages });
      setMessages([...next, { role: 'assistant' as const, content: r.data.answer }]);
      if (r.data.model && r.data.model !== 'fallback') setModel(prettyModel(r.data.model));
    } catch (e: any) {
      const detail = e?.response?.data?.message || e?.message || t('ai.unknownErr');
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
      setMessages([...next, { role: 'assistant' as const, content: `${t('ai.errAnswer')}${status}: ${detail}` }]);
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

  async function clearChat() {
    if (messages.length === 0) return;
    const ok = await confirmDialog({ title: t('ai.clearTitle'), body: t('ai.clearBody'), danger: true, okLabel: t('btn.clear') });
    if (ok) { clear(); toast.success(t('ai.cleared')); }
  }

  const roleKey: any = `ai.role.${user?.role || 'STUDENT'}`;
  const aboutKey: any = user?.role === 'ADMIN' ? 'ai.aboutAdmin' : user?.role === 'TEACHER' ? 'ai.aboutTeacher' : 'ai.aboutStudent';

  return (
    <Shell title={t('ai.title')}>
      <div className="ai-shell">
        <div className="ai-header">
          <div className="ai-avatar">
            <BotIcon />
          </div>
          <div>
            <div className="ai-title">{t('ai.title')}</div>
            <div className="ai-subtitle">{t('ai.subtitle')}{t(roleKey)}</div>
          </div>
          <div className="ai-header-actions">
            <div className="ai-model-pill"><span className="dot" /> {model || 'AI'}</div>
            {messages.length > 0 && (
              <button className="ai-clear-btn" onClick={clearChat} title={t('ai.clearTitle')} aria-label={t('ai.clearChat')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="ai-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="ai-empty">
              <div className="big-bot"><BotIcon /></div>
              <h2>{t('ai.askPrompt')}</h2>
              <p>
                {t('ai.askLeading')}
                {t(aboutKey)}
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
            placeholder={t('ai.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button className="ai-send" disabled={!input.trim() || loading} onClick={() => send(input)} title={t('btn.send')}>
            <SendIcon />
          </button>
        </div>
        <div className="ai-disclaimer">
          {t('ai.disclaimer')}
        </div>
      </div>
    </Shell>
  );
}

function prettyModel(m: string) {
  if (!m) return 'AI';
  if (m.startsWith('gemini/')) {
    const name = m.replace('gemini/', '');
    if (name.includes('2.5-flash')) return 'Gemini 2.5 Flash';
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
