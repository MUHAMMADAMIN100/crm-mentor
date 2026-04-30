import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Loading } from '../../components/Loading';
import { toast } from '../../store';
import { useT } from '../../i18n';

export function StudentCourseView() {
  const { t } = useT();
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<any>(null);

  function load() { api.get(`/courses/me/${id}`).then((r) => setData(r.data)); }
  useEffect(load, [id]);

  if (!data) return <Shell title={t('course.title')}><Loading label={t('loader.course')} /></Shell>;
  if (data.expired) {
    return <Shell title={data.course.title}>
      <div className="card">
        <h3 style={{ color: 'var(--danger)' }}>{t('course.expired')}</h3>
        <p>{t('course.expiredBody')}</p>
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
                  onClick={() => { setActive(l); }}
                >
                  {l.title}
                  {l.isHomework && <span className="badge badge-warning" style={{ marginLeft: 8 }}>{t('course.dz')}</span>}
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
                {t('course.toLessons')}
              </button>
              <LessonView lesson={active} onChange={load} />
            </>
          ) : (
            <div className="empty">{t('empty.selectLesson')}</div>
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
    toast.error(e?.response?.data?.message || 'mark failed');
    throw e;
  }
}

function VideoBlock({ block, onDone }: any) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>{t('block.VIDEO')}</h4>
      {block.videoUrls.map((u: string) => <div key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={done} onClick={async () => {
          try { await markDone(block.id); setDone(true); toast.success(t('btn.viewed')); onDone(); } catch {}
        }}>{done ? t('btn.viewedDone') : t('btn.viewed')}</button>
      </div>
    </div>
  );
}

function TextBlock({ block, onDone }: any) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>{block.textTitle}</h4>
      <div style={{ whiteSpace: 'pre-wrap' }}>{block.textBody}</div>
      {block.miniQuizQuestion ? (
        <div style={{ marginTop: 10 }}>
          <p>{block.miniQuizQuestion}</p>
          <button className="btn btn-sm" disabled={done} onClick={async () => { try { await markDone(block.id, { answer: true }); setDone(true); toast.success(t('toast.success')); onDone(); } catch {} }}>{t('btn.true')}</button>{' '}
          <button className="btn btn-sm" disabled={done} onClick={async () => { try { await markDone(block.id, { answer: false }); setDone(true); toast.success(t('toast.success')); onDone(); } catch {} }}>{t('btn.false')}</button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-primary" disabled={done} onClick={async () => { try { await markDone(block.id); setDone(true); toast.success(t('btn.read')); onDone(); } catch {} }}>{done ? t('btn.readDone') : t('btn.read')}</button>
        </div>
      )}
    </div>
  );
}

function FileBlock({ block, onDone }: any) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>{t('block.FILE')}</h4>
      {block.fileUrls.map((u: string) => <div key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={done} onClick={async () => { try { await markDone(block.id); setDone(true); toast.success(t('toast.success')); onDone(); } catch {} }}>{done ? t('btn.gotItDone') : t('btn.gotIt')}</button>
      </div>
    </div>
  );
}

function WrittenBlock({ block, onDone }: any) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="card">
      <h4>{t('block.written.title')}</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{block.writtenPrompt}</p>
      <textarea className="textarea" placeholder={block.writtenHint || t('block.written.placeholder')} value={text} onChange={(e) => setText(e.target.value)} disabled={done} style={{ minHeight: 120 }} />
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" disabled={!text.trim() || submitting || done} onClick={async () => {
          setSubmitting(true);
          try { await markDone(block.id, { text }); setDone(true); toast.success(t('toast.success')); onDone(); }
          catch {}
          finally { setSubmitting(false); }
        }}>{done ? t('btn.gotItDone') : submitting ? t('status.sending') : t('btn.send')}</button>
      </div>
    </div>
  );
}

/* ---------------------------- QUIZ STUDENT ---------------------------- */

function QuizBlock({ block, onDone }: any) {
  const { t } = useT();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<{ score: number; correct: any } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const payload: Record<string, any> = block.quizPayload && typeof block.quizPayload === 'object' ? block.quizPayload : {};
  const questions = Object.entries(payload);

  async function submit() {
    if (questions.length === 0) return;
    if (questions.some(([k]) => !answers[k] && answers[k] !== 0)) {
      toast.warning(t('quiz.fillAll'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post(`/progress/blocks/${block.id}/quiz`, { answers });
      setResult({ score: r.data.score ?? 0, correct: r.data.correct || {} });
      toast.success(`${t('quiz.sentBy')} ${Math.round((r.data.score ?? 0) * 100)}%`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('quiz.notSent'));
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
      <h4>{t(`quiz.kind.${block.quizKind}` as any) || t('block.QUIZ')}</h4>

      {!result && total > 0 && (
        <div style={{ background: 'var(--surface-2)', height: 6, borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', transition: '0.25s' }} />
        </div>
      )}

      <div className="quiz-wrap">
        {questions.length === 0 && <div className="empty">{t('empty.emptyQuiz')}</div>}
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
            ) : Array.isArray(q.right) && q.right.length > 0 ? (
              // MATCHING — render left prompt + select among right options
              <div>
                {q.left && <div style={{ marginBottom: 8, fontWeight: 500 }}>{q.left}</div>}
                <div className="quiz-options">
                  {q.right.map((opt: string, oi: number) => {
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
              </div>
            ) : (
              <input className="input" placeholder={t('quiz.yourAnswer')} value={answers[qid] || ''} disabled={!!result}
                onChange={(e) => setAnswers({ ...answers, [qid]: e.target.value })} />
            )}
            {result && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t('quiz.correctAnswer')} <strong>{String(result.correct[qid] ?? '—')}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {result ? (
        <>
          <div className={`quiz-result ${result.score >= 0.8 ? 'high' : result.score < 0.5 ? 'low' : ''}`}>
            <div className="score-num">{Math.round(result.score * 100)}%</div>
            <div className="score-label">{resultMessage(result.score, t)}</div>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="btn" onClick={reset}>{t('btn.retake')}</button>
          </div>
        </>
      ) : total > 0 && (
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? t('status.sending') : t('btn.submit')}
          </button>
        </div>
      )}
    </div>
  );
}

function resultMessage(score: number, t: any) {
  if (score >= 0.9) return t('quiz.high');
  if (score >= 0.7) return t('quiz.good');
  if (score >= 0.5) return t('quiz.normal');
  return t('quiz.low');
}
