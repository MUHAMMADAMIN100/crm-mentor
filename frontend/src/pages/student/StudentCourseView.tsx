import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';

export function StudentCourseView() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [showToc, setShowToc] = useState(true);

  function load() { api.get(`/courses/me/${id}`).then((r) => setData(r.data)); }
  useEffect(load, [id]);

  if (!data) return <Shell title="Курс"><Loading label="Открываем курс…" /></Shell>;
  if (data.expired) {
    return <Shell title={data.course.title}>
      <div className="card">
        <h3 style={{ color: 'var(--danger)' }}>Срок доступа к курсу закончился</h3>
        <p>Для продолжения обучения нужно продлить доступ.</p>
      </div>
    </Shell>;
  }

  return (
    <Shell title={data.course.title}>
      <div className={`course-shell ${active ? 'has-active' : 'no-active'}`} style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div className="card course-toc" style={{ padding: 0 }}>
          {data.course.modules.map((m: any) => (
            <div key={m.id}>
              <div style={{ padding: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{m.title}</div>
              {m.lessons.map((l: any) => (
                <div
                  key={l.id}
                  className={`chat-list-item ${active?.id === l.id ? 'active' : ''}`}
                  onClick={() => { setActive(l); setShowToc(false); }}
                >
                  {l.title}
                  {l.isHomework && <span className="badge badge-warning" style={{ marginLeft: 8 }}>ДЗ</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="card course-pane">
          {active ? (
            <>
              <button className="chat-back" style={{ marginBottom: 10 }} onClick={() => setActive(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                К списку уроков
              </button>
              <LessonView lesson={active} onChange={load} />
            </>
          ) : (
            <div className="empty">Выберите урок слева</div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function LessonView({ lesson, onChange }: any) {
  return (
    <div>
      <h3>{lesson.title}</h3>
      <div className="flex-col" style={{ gap: 16 }}>
        {lesson.blocks.map((b: any) => (
          <BlockView key={b.id} block={b} onDone={onChange} />
        ))}
      </div>
    </div>
  );
}

function BlockView({ block, onDone }: any) {
  if (block.type === 'VIDEO') return <VideoBlock block={block} onDone={onDone} />;
  if (block.type === 'TEXT') return <TextBlock block={block} onDone={onDone} />;
  if (block.type === 'FILE') return <FileBlock block={block} onDone={onDone} />;
  if (block.type === 'WRITTEN') return <WrittenBlock block={block} onDone={onDone} />;
  if (block.type === 'QUIZ') return <QuizBlock block={block} onDone={onDone} />;
  return null;
}

async function markDone(blockId: string, extra?: any) {
  try {
    await api.post(`/progress/blocks/${blockId}/done`, { data: extra });
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Не удалось отметить выполнение');
    throw e;
  }
}

function VideoBlock({ block, onDone }: any) {
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>Видео</h4>
      {block.videoUrls.map((u: string) => <div key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={done} onClick={async () => {
          try { await markDone(block.id); setDone(true); toast.success('Просмотрено'); onDone(); } catch {}
        }}>{done ? 'Просмотрено ✓' : 'Просмотрено'}</button>
      </div>
    </div>
  );
}

function TextBlock({ block, onDone }: any) {
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>{block.textTitle}</h4>
      <div style={{ whiteSpace: 'pre-wrap' }}>{block.textBody}</div>
      {block.miniQuizQuestion ? (
        <div style={{ marginTop: 10 }}>
          <p>{block.miniQuizQuestion}</p>
          <button className="btn btn-sm" disabled={done} onClick={async () => { try { await markDone(block.id, { answer: true }); setDone(true); toast.success('Ответ принят'); onDone(); } catch {} }}>Истина</button>{' '}
          <button className="btn btn-sm" disabled={done} onClick={async () => { try { await markDone(block.id, { answer: false }); setDone(true); toast.success('Ответ принят'); onDone(); } catch {} }}>Ложь</button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-primary" disabled={done} onClick={async () => { try { await markDone(block.id); setDone(true); toast.success('Прочитано'); onDone(); } catch {} }}>{done ? 'Прочитано ✓' : 'Прочитано'}</button>
        </div>
      )}
    </div>
  );
}

function FileBlock({ block, onDone }: any) {
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>Файлы</h4>
      {block.fileUrls.map((u: string) => <div key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={done} onClick={async () => { try { await markDone(block.id); setDone(true); toast.success('Готово'); onDone(); } catch {} }}>{done ? 'Готово ✓' : 'Ознакомлен'}</button>
      </div>
    </div>
  );
}

function WrittenBlock({ block, onDone }: any) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>Письменное задание</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{block.writtenPrompt}</p>
      <textarea className="textarea" placeholder={block.writtenHint || 'Ваш ответ…'} value={text} onChange={(e) => setText(e.target.value)} disabled={done} style={{ minHeight: 120 }} />
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={!text.trim() || submitting || done} onClick={async () => {
          setSubmitting(true);
          try { await markDone(block.id, { text }); setDone(true); toast.success('Ответ отправлен'); onDone(); }
          catch {}
          finally { setSubmitting(false); }
        }}>{done ? 'Отправлено ✓' : submitting ? 'Отправляем…' : 'Отправить'}</button>
      </div>
    </div>
  );
}

/* ---------------------------- QUIZ STUDENT ---------------------------- */

function QuizBlock({ block, onDone }: any) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<{ score: number; correct: any } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const payload: Record<string, any> = block.quizPayload && typeof block.quizPayload === 'object' ? block.quizPayload : {};
  const questions = Object.entries(payload);

  async function submit() {
    if (questions.length === 0) return;
    if (questions.some(([k]) => !answers[k] && answers[k] !== 0)) {
      toast.warning('Ответьте на все вопросы');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post(`/progress/blocks/${block.id}/quiz`, { answers });
      setResult({ score: r.data.score ?? 0, correct: r.data.correct || {} });
      toast.success(`Тест отправлен: ${Math.round((r.data.score ?? 0) * 100)}%`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Не удалось отправить');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAnswers({});
    setResult(null);
  }

  const total = questions.length;
  const filled = questions.filter(([k]) => answers[k] !== undefined && answers[k] !== '').length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="card">
      <h4>{labelForKind(block.quizKind)}</h4>

      {!result && total > 0 && (
        <div style={{ background: 'var(--surface-2)', height: 6, borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', transition: '0.25s' }} />
        </div>
      )}

      <div className="quiz-wrap">
        {questions.length === 0 && <div className="empty">Тест пока пустой</div>}
        {questions.map(([qid, q]: any, idx: number) => (
          <div key={qid} className="quiz-question">
            <h5>{idx + 1}. {q.q || qid}</h5>
            {Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="quiz-options">
                {q.options.map((opt: string, oi: number) => {
                  const selected = answers[qid] === opt;
                  let cls = 'quiz-option';
                  if (result) {
                    const isRight = result.correct[qid] === opt;
                    if (isRight) cls += ' correct';
                    else if (selected) cls += ' wrong';
                  } else if (selected) cls += ' selected';
                  return (
                    <div key={oi} className={cls} onClick={() => !result && setAnswers({ ...answers, [qid]: opt })}>
                      <div className="marker">{result ? (result.correct[qid] === opt ? '✓' : selected ? '✕' : '') : (selected ? '●' : String.fromCharCode(65 + oi))}</div>
                      <div style={{ flex: 1 }}>{opt}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <input
                className="input"
                placeholder="Ваш ответ"
                value={answers[qid] || ''}
                disabled={!!result}
                onChange={(e) => setAnswers({ ...answers, [qid]: e.target.value })}
              />
            )}
            {result && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Правильный ответ: <strong>{String(result.correct[qid] ?? '—')}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {result ? (
        <>
          <div className={`quiz-result ${result.score >= 0.8 ? 'high' : result.score < 0.5 ? 'low' : ''}`}>
            <div className="score-num">{Math.round(result.score * 100)}%</div>
            <div className="score-label">{resultMessage(result.score)}</div>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="btn" onClick={reset}>Пройти заново</button>
          </div>
        </>
      ) : total > 0 && (
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Отправляем…' : 'Отправить ответы'}
          </button>
        </div>
      )}
    </div>
  );
}

function labelForKind(k: string) {
  return ({
    CHOICE: 'Тест с вариантами',
    PICK_RIGHT: 'Выберите правильный ответ',
    FILL_SENT: 'Заполните предложения',
    MATCHING: 'Сопоставление',
    FILL_GAPS: 'Заполните пропуски',
  } as any)[k] || 'Тест';
}

function resultMessage(score: number) {
  if (score >= 0.9) return 'Отлично! Почти всё верно 🎉';
  if (score >= 0.7) return 'Хорошо — есть что подтянуть';
  if (score >= 0.5) return 'Можно лучше — попробуй ещё раз';
  return 'Стоит повторить материал и пройти заново';
}
