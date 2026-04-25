import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';

export function StudentCourseView() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<any>(null);

  function load() { api.get(`/courses/me/${id}`).then((r) => setData(r.data)); }
  useEffect(load, [id]);

  if (!data) return <Shell title="Курс"><div>Загрузка…</div></Shell>;
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
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          {data.course.modules.map((m: any) => (
            <div key={m.id}>
              <div style={{ padding: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{m.title}</div>
              {m.lessons.map((l: any) => (
                <div
                  key={l.id}
                  className={`chat-list-item ${active?.id === l.id ? 'active' : ''}`}
                  onClick={() => setActive(l)}
                >
                  {l.title}
                  {l.isHomework && <span className="badge badge-warning" style={{ marginLeft: 8 }}>ДЗ</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="card">
          {active ? <LessonView lesson={active} onChange={load} /> : <div className="empty">Выберите урок слева</div>}
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
  await api.post(`/progress/blocks/${blockId}/done`, { data: extra });
}

function VideoBlock({ block, onDone }: any) {
  return (
    <div className="card">
      <h4>Видео</h4>
      {block.videoUrls.map((u: string) => <div key={u}><a href={u} target="_blank">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={async () => { await markDone(block.id); onDone(); }}>Просмотрено</button>
      </div>
    </div>
  );
}
function TextBlock({ block, onDone }: any) {
  return (
    <div className="card">
      <h4>{block.textTitle}</h4>
      <div style={{ whiteSpace: 'pre-wrap' }}>{block.textBody}</div>
      {block.miniQuizQuestion ? (
        <div style={{ marginTop: 10 }}>
          <p>{block.miniQuizQuestion}</p>
          <button className="btn btn-sm" onClick={async () => { await markDone(block.id, { answer: true }); onDone(); }}>Истина</button>{' '}
          <button className="btn btn-sm" onClick={async () => { await markDone(block.id, { answer: false }); onDone(); }}>Ложь</button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={async () => { await markDone(block.id); onDone(); }}>Прочитано</button>
        </div>
      )}
    </div>
  );
}
function FileBlock({ block, onDone }: any) {
  return (
    <div className="card">
      <h4>Файлы</h4>
      {block.fileUrls.map((u: string) => <div key={u}><a href={u} target="_blank">{u}</a></div>)}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={async () => { await markDone(block.id); onDone(); }}>Ознакомлен</button>
      </div>
    </div>
  );
}
function WrittenBlock({ block, onDone }: any) {
  const [text, setText] = useState('');
  return (
    <div className="card">
      <h4>Письменное задание</h4>
      <p>{block.writtenPrompt}</p>
      <textarea className="textarea" placeholder={block.writtenHint || ''} value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={async () => { await markDone(block.id, { text }); onDone(); }}>Отправить</button>
      </div>
    </div>
  );
}
function QuizBlock({ block, onDone }: any) {
  const [answers, setAnswers] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const payload = block.quizPayload || {};
  async function submit() {
    const r = await api.post(`/progress/blocks/${block.id}/quiz`, { answers });
    setResult(r.data);
    onDone();
  }
  return (
    <div className="card">
      <h4>Квиз: {block.quizKind}</h4>
      {Object.entries(payload).map(([qid, q]: any) => (
        <div key={qid} className="field">
          <label>{q.q || qid}</label>
          {Array.isArray(q.options) ? (
            <select className="select" value={answers[qid] || ''} onChange={(e) => setAnswers({ ...answers, [qid]: e.target.value })}>
              <option value="">—</option>
              {q.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input className="input" value={answers[qid] || ''} onChange={(e) => setAnswers({ ...answers, [qid]: e.target.value })} />
          )}
        </div>
      ))}
      <button className="btn btn-primary" onClick={submit}>Отправить</button>
      {result && (
        <div style={{ marginTop: 12 }}>
          Результат: {(result.score * 100).toFixed(0)}%
          <pre style={{ background: 'var(--surface-2)', padding: 8, borderRadius: 6, fontSize: 12 }}>{JSON.stringify(result.correct, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
