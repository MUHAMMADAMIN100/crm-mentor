import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast, confirmDialog } from '../../store';

export function TeacherCourseEditor() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [adding, setAdding] = useState<{ kind: 'module' } | { kind: 'lesson'; mid: string } | null>(null);

  function load() { api.get(`/courses/${id}`).then((r) => setCourse(r.data)); }
  useEffect(() => { load(); api.get('/students').then((r) => setStudents(r.data)); }, [id]);

  if (!course) return <Shell title="Курс"><Loading label="Открываем курс…" /></Shell>;

  return (
    <Shell title={course.title}>
      <div className="flex" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="badge badge-neutral">{course.status}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setAccessOpen(true)}>Доступы</button>
        <button className="btn btn-primary" onClick={() => setAdding({ kind: 'module' })}>+ Модуль</button>
      </div>

      <div className="flex-col">
        {course.modules.map((m: any) => (
          <div className="card" key={m.id}>
            <div className="flex">
              <h3 style={{ margin: 0 }}>{m.title}</h3>
              <div className="spacer" />
              <button className="btn btn-sm" onClick={() => setAdding({ kind: 'lesson', mid: m.id })}>+ Урок</button>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {m.lessons.map((l: any) => (
                <div key={l.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="flex">
                    <div style={{ fontWeight: 500 }}>{l.title}</div>
                    {l.isHomework && <span className="badge badge-warning">ДЗ</span>}
                    <div className="spacer" />
                    <button className="btn btn-sm" onClick={() => setEditingLesson(l)}>Редактировать</button>
                  </div>
                </div>
              ))}
              {m.lessons.length === 0 && <div className="empty">Нет уроков</div>}
            </div>
          </div>
        ))}
        {course.modules.length === 0 && <div className="empty">Нет модулей</div>}
      </div>

      {accessOpen && (
        <AccessModal courseId={course.id} accesses={course.accesses} students={students} onClose={() => { setAccessOpen(false); load(); }} />
      )}

      {editingLesson && (
        <LessonEditor lesson={editingLesson} onClose={() => { setEditingLesson(null); load(); }} />
      )}

      {adding?.kind === 'module' && (
        <SimpleNameModal title="Новый модуль" placeholder="Название модуля" onClose={(name) => {
          setAdding(null);
          if (name) api.post(`/courses/${id}/modules`, { title: name })
            .then(() => { load(); toast.success('Модуль создан'); })
            .catch(() => toast.error('Не удалось создать'));
        }} />
      )}
      {adding?.kind === 'lesson' && (
        <SimpleNameModal title="Новый урок" placeholder="Название урока" onClose={(name) => {
          const mid = adding.mid;
          setAdding(null);
          if (name) api.post(`/courses/modules/${mid}/lessons`, { title: name })
            .then(() => { load(); toast.success('Урок создан'); })
            .catch(() => toast.error('Не удалось создать'));
        }} />
      )}
    </Shell>
  );
}

function SimpleNameModal({ title, placeholder, onClose }: any) {
  const [name, setName] = useState('');
  return (
    <Modal open onClose={() => onClose(null)} title={title}
      footer={<><button className="btn" onClick={() => onClose(null)}>Отмена</button><button className="btn btn-primary" onClick={() => onClose(name.trim() || null)} disabled={!name.trim()}>Создать</button></>}>
      <div className="field">
        <input className="input" autoFocus placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onClose(name.trim())} />
      </div>
    </Modal>
  );
}

function AccessModal({ courseId, accesses, students, onClose }: any) {
  const [picked, setPicked] = useState<string[]>([]);
  const [paid, setPaid] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  async function grant() {
    try {
      await api.post(`/courses/${courseId}/access`, { studentProfileIds: picked, paid, expiresAt: expiresAt || undefined });
      toast.success('Доступ открыт');
      onClose();
    } catch { toast.error('Не удалось открыть доступ'); }
  }
  async function revoke(sid: string) {
    const ok = await confirmDialog({ title: 'Закрыть доступ?', danger: true, okLabel: 'Закрыть' });
    if (!ok) return;
    try {
      await api.delete(`/courses/${courseId}/access/${sid}`);
      toast.success('Доступ закрыт');
      onClose();
    } catch { toast.error('Не удалось'); }
  }
  return (
    <Modal open onClose={onClose} title="Доступ к курсу" width={560}
      footer={<><button className="btn" onClick={onClose}>Закрыть</button><button className="btn btn-primary" onClick={grant} disabled={picked.length === 0}>Открыть доступ</button></>}>
      <div className="field"><label>Выбрать учеников</label>
        <div className="list" style={{ maxHeight: 180, overflowY: 'auto' }}>
          {students.map((s: any) => (
            <label key={s.id} className="list-item">
              <span>{s.user.fullName}</span>
              <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
            </label>
          ))}
        </div>
      </div>
      <div className="row">
        <div className="field"><label><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Платный</label></div>
        <div className="field"><label>Срок до</label><input type="date" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
      </div>
      <div className="h-divider" />
      <h4 style={{ margin: '0 0 8px' }}>Текущие доступы</h4>
      <div className="list">
        {accesses.map((a: any) => (
          <div key={a.id} className="list-item">
            <div>{a.student.user.fullName} {a.expiresAt && <span className="muted"> · до {new Date(a.expiresAt).toLocaleDateString('ru-RU')}</span>}</div>
            <button className="btn btn-sm btn-danger" onClick={() => revoke(a.studentId)}>×</button>
          </div>
        ))}
        {accesses.length === 0 && <div className="empty">Никому не открыто</div>}
      </div>
    </Modal>
  );
}

function LessonEditor({ lesson, onClose }: any) {
  const [data, setData] = useState({
    title: lesson.title,
    isHomework: lesson.isHomework,
    deadlineMode: lesson.deadlineMode,
    deadlineAt: lesson.deadlineAt ? lesson.deadlineAt.slice(0, 16) : '',
    aiHelper: lesson.aiHelper,
  });
  const [blocks, setBlocks] = useState<any[]>(lesson.blocks || []);
  const [adding, setAdding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveLesson() {
    setSaving(true);
    try {
      await api.patch(`/courses/lessons/${lesson.id}`, {
        ...data,
        deadlineAt: data.deadlineMode === 'MANUAL' && data.deadlineAt ? new Date(data.deadlineAt).toISOString() : null,
      });
      toast.success('Урок сохранён');
      onClose();
    } catch { toast.error('Не удалось сохранить'); } finally { setSaving(false); }
  }
  async function addBlock(type: string, payload: any) {
    try {
      const b = await api.post(`/courses/lessons/${lesson.id}/blocks`, { type, ...payload });
      setBlocks([...blocks, b.data]);
      setAdding(null);
      toast.success('Блок добавлен');
    } catch { toast.error('Не удалось добавить блок'); }
  }
  async function deleteBlock(bid: string) {
    const ok = await confirmDialog({ title: 'Удалить блок?', danger: true, okLabel: 'Удалить' });
    if (!ok) return;
    try {
      await api.delete(`/courses/blocks/${bid}`);
      setBlocks(blocks.filter((x) => x.id !== bid));
      toast.success('Блок удалён');
    } catch { toast.error('Не удалось'); }
  }
  async function toggleBlockHomework(b: any) {
    try {
      await api.patch(`/courses/blocks/${b.id}`, { isHomework: !b.isHomework });
      setBlocks(blocks.map((x) => x.id === b.id ? { ...x, isHomework: !x.isHomework } : x));
    } catch { toast.error('Не удалось обновить'); }
  }

  return (
    <Modal open onClose={onClose} title="Редактирование урока" width={680}
      footer={<><button className="btn" onClick={onClose}>Закрыть</button><button className="btn btn-primary" onClick={saveLesson} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить урок'}</button></>}>
      <div className="field"><label>Название</label><input className="input" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label><input type="checkbox" checked={data.isHomework} onChange={(e) => setData({ ...data, isHomework: e.target.checked })} /> Это домашнее задание</label></div>
        <div className="field"><label><input type="checkbox" checked={data.aiHelper} onChange={(e) => setData({ ...data, aiHelper: e.target.checked })} /> Включить AI-помощника</label></div>
      </div>
      {data.isHomework && (
        <div className="row">
          <div className="field"><label>Дедлайн</label>
            <select className="select" value={data.deadlineMode} onChange={(e) => setData({ ...data, deadlineMode: e.target.value })}>
              <option value="NEXT_LESSON">До следующего занятия</option>
              <option value="MANUAL">Вручную</option>
              <option value="NONE">Без дедлайна</option>
            </select>
          </div>
          {data.deadlineMode === 'MANUAL' && (
            <div className="field"><label>Дата/время</label><input type="datetime-local" className="input" value={data.deadlineAt} onChange={(e) => setData({ ...data, deadlineAt: e.target.value })} /></div>
          )}
        </div>
      )}

      <div className="h-divider" />
      <h4 style={{ margin: '0 0 8px' }}>Блоки урока</h4>
      <div className="list" style={{ maxHeight: 240, overflowY: 'auto' }}>
        {blocks.map((b) => (
          <div key={b.id} className="list-item">
            <div>
              <span className="badge badge-neutral">{b.type}</span>{' '}
              <span style={{ fontWeight: 500 }}>{blockTitle(b)}</span>
            </div>
            <div className="flex">
              <label className="muted" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={b.isHomework} onChange={() => toggleBlockHomework(b)} /> ДЗ
              </label>
              <button className="btn btn-sm btn-danger" onClick={() => deleteBlock(b.id)}>×</button>
            </div>
          </div>
        ))}
        {blocks.length === 0 && <div className="empty">Блоков нет</div>}
      </div>

      <div className="h-divider" />
      <div className="flex" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => setAdding('VIDEO')}>+ Видео</button>
        <button className="btn btn-sm" onClick={() => setAdding('TEXT')}>+ Текст</button>
        <button className="btn btn-sm" onClick={() => setAdding('FILE')}>+ Файлы</button>
        <button className="btn btn-sm" onClick={() => setAdding('QUIZ')}>+ Тест</button>
        <button className="btn btn-sm" onClick={() => setAdding('WRITTEN')}>+ Письменное</button>
      </div>

      {adding && <BlockForm type={adding} onCancel={() => setAdding(null)} onAdd={(payload) => addBlock(adding, payload)} />}
    </Modal>
  );
}

function blockTitle(b: any) {
  if (b.textTitle) return b.textTitle;
  if (b.writtenPrompt) return b.writtenPrompt.slice(0, 60);
  if (b.videoUrls?.[0]) return b.videoUrls[0];
  if (b.fileUrls?.length) return `${b.fileUrls.length} файл(ов)`;
  if (b.quizKind) {
    const cnt = b.quizPayload && typeof b.quizPayload === 'object' ? Object.keys(b.quizPayload).length : 0;
    return `Тест · ${cnt} вопрос(ов)`;
  }
  return 'Блок';
}

function BlockForm({ type, onCancel, onAdd }: any) {
  const [state, setState] = useState<any>({});
  function update(k: string, v: any) { setState((s: any) => ({ ...s, [k]: v })); }

  function submit() {
    if (type === 'VIDEO') {
      const urls = (state.urls || '').split(/\s+/).filter(Boolean);
      if (urls.length === 0) return toast.warning('Добавьте URL видео');
      onAdd({ videoUrls: urls });
    } else if (type === 'TEXT') {
      if (!state.textTitle && !state.textBody) return toast.warning('Заполните текст');
      onAdd({ textTitle: state.textTitle, textBody: state.textBody, miniQuizQuestion: state.miniQuizQuestion || null, miniQuizAnswer: state.miniQuizAnswer ?? null });
    } else if (type === 'FILE') {
      const urls = (state.urls || '').split(/\s+/).filter(Boolean).slice(0, 5);
      if (urls.length === 0) return toast.warning('Добавьте URL файлов');
      onAdd({ fileUrls: urls });
    } else if (type === 'WRITTEN') {
      if (!state.prompt) return toast.warning('Опишите задание');
      onAdd({ writtenPrompt: state.prompt, writtenHint: state.hint });
    } else if (type === 'QUIZ') {
      onAdd({ quizKind: state.quizKind, quizPayload: state.payload, quizCorrect: state.correct });
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Новый блок: {labelForType(type)}</h3>
      {type === 'VIDEO' && <div className="field"><label>URL видео (через пробел)</label><textarea className="textarea" placeholder="https://youtube.com/watch?v=… https://…" onChange={(e) => update('urls', e.target.value)} /></div>}
      {type === 'TEXT' && (<>
        <div className="field"><label>Заголовок</label><input className="input" onChange={(e) => update('textTitle', e.target.value)} /></div>
        <div className="field"><label>Текст</label><textarea className="textarea" style={{ minHeight: 140 }} onChange={(e) => update('textBody', e.target.value)} /></div>
        <div className="field"><label>Мини-проверка (необязательно — true/false)</label><input className="input" placeholder="Утверждение для проверки" onChange={(e) => update('miniQuizQuestion', e.target.value)} /></div>
        <div className="field"><label>Правильный ответ</label>
          <select className="select" onChange={(e) => update('miniQuizAnswer', e.target.value === '' ? null : e.target.value === 'true')}>
            <option value="">— нет проверки —</option><option value="true">Истина</option><option value="false">Ложь</option>
          </select>
        </div>
      </>)}
      {type === 'FILE' && <div className="field"><label>URL файлов (через пробел, до 5)</label><textarea className="textarea" onChange={(e) => update('urls', e.target.value)} /></div>}
      {type === 'WRITTEN' && (<>
        <div className="field"><label>Задание</label><textarea className="textarea" placeholder="Что должен сделать ученик…" onChange={(e) => update('prompt', e.target.value)} /></div>
        <div className="field"><label>Подсказка (необязательно)</label><input className="input" onChange={(e) => update('hint', e.target.value)} /></div>
      </>)}
      {type === 'QUIZ' && <QuizBuilder onChange={(kind, payload, correct) => { update('quizKind', kind); update('payload', payload); update('correct', correct); }} />}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>Отмена</button>
        <button className="btn btn-primary" onClick={submit}>Добавить</button>
      </div>
    </div>
  );
}

function labelForType(t: string) {
  return ({ VIDEO: 'Видео', TEXT: 'Текст', FILE: 'Файлы', QUIZ: 'Тест', WRITTEN: 'Письменное' } as any)[t] || t;
}

/* ---------------------------- QUIZ BUILDER ---------------------------- */

interface BuilderQuestion {
  key: string;
  q: string;
  kind: 'CHOICE' | 'TEXT';
  options: string[];
  correct: number; // index of correct option for CHOICE
  textCorrect: string; // for TEXT
}

function QuizBuilder({ onChange }: { onChange: (kind: string, payload: any, correct: any) => void }) {
  const [kind, setKind] = useState<'CHOICE' | 'PICK_RIGHT' | 'FILL_SENT' | 'MATCHING' | 'FILL_GAPS'>('CHOICE');
  const [questions, setQuestions] = useState<BuilderQuestion[]>([
    { key: 'q1', q: '', kind: 'CHOICE', options: ['', ''], correct: 0, textCorrect: '' },
  ]);

  function emit(qs: BuilderQuestion[], k: string) {
    const payload: any = {};
    const correct: any = {};
    qs.forEach((q) => {
      if (q.kind === 'CHOICE') {
        payload[q.key] = { q: q.q, options: q.options.filter(Boolean) };
        correct[q.key] = q.options[q.correct] || '';
      } else {
        payload[q.key] = { q: q.q };
        correct[q.key] = q.textCorrect;
      }
    });
    onChange(k, payload, correct);
  }

  function update(next: BuilderQuestion[]) {
    setQuestions(next);
    emit(next, kind);
  }

  function addQuestion() {
    const key = `q${questions.length + 1}`;
    update([...questions, { key, q: '', kind: 'CHOICE', options: ['', ''], correct: 0, textCorrect: '' }]);
  }
  function removeQuestion(idx: number) {
    update(questions.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="field"><label>Тип теста</label>
        <select className="select" value={kind} onChange={(e) => { const k = e.target.value as any; setKind(k); emit(questions, k); }}>
          <option value="CHOICE">Тест с вариантами</option>
          <option value="PICK_RIGHT">Выбрать правильный</option>
          <option value="FILL_SENT">Заполнить предложения</option>
          <option value="MATCHING">Сопоставление</option>
          <option value="FILL_GAPS">Заполнить пропуски</option>
        </select>
      </div>

      <h4 style={{ margin: '12px 0 8px', fontSize: 13, color: 'var(--text-soft)' }}>ВОПРОСЫ</h4>
      {questions.map((q, idx) => (
        <div key={q.key} className="qb-question">
          <div className="qh">
            <div className="qn">{idx + 1}</div>
            <input className="input" placeholder="Текст вопроса" value={q.q} onChange={(e) => {
              const next = [...questions]; next[idx] = { ...q, q: e.target.value }; update(next);
            }} />
            {questions.length > 1 && (
              <button className="btn btn-sm btn-danger" onClick={() => removeQuestion(idx)} aria-label="Удалить вопрос">×</button>
            )}
          </div>

          <div className="row" style={{ marginBottom: 6 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Формат ответа</label>
              <select className="select" value={q.kind} onChange={(e) => {
                const next = [...questions]; next[idx] = { ...q, kind: e.target.value as any }; update(next);
              }}>
                <option value="CHOICE">Варианты ответа</option>
                <option value="TEXT">Свободный ответ</option>
              </select>
            </div>
          </div>

          {q.kind === 'CHOICE' ? (
            <div className="qb-options">
              {q.options.map((opt, oi) => (
                <div key={oi} className="qb-option">
                  <button
                    type="button"
                    className={`btn-correct ${q.correct === oi ? 'is-correct' : ''}`}
                    title="Отметить как правильный"
                    onClick={() => {
                      const next = [...questions]; next[idx] = { ...q, correct: oi }; update(next);
                    }}
                  >
                    {q.correct === oi ? '✓' : ''}
                  </button>
                  <input className="input" placeholder={`Вариант ${oi + 1}`} value={opt} onChange={(e) => {
                    const opts = [...q.options]; opts[oi] = e.target.value;
                    const next = [...questions]; next[idx] = { ...q, options: opts }; update(next);
                  }} />
                  {q.options.length > 2 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => {
                      const opts = q.options.filter((_, i) => i !== oi);
                      const newCorrect = q.correct >= opts.length ? 0 : q.correct;
                      const next = [...questions]; next[idx] = { ...q, options: opts, correct: newCorrect }; update(next);
                    }}>×</button>
                  )}
                </div>
              ))}
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => {
                const next = [...questions]; next[idx] = { ...q, options: [...q.options, ''] }; update(next);
              }}>+ Вариант</button>
            </div>
          ) : (
            <div className="field" style={{ marginTop: 6 }}>
              <label>Правильный ответ</label>
              <input className="input" value={q.textCorrect} onChange={(e) => {
                const next = [...questions]; next[idx] = { ...q, textCorrect: e.target.value }; update(next);
              }} placeholder="Точный ответ (без учёта регистра)" />
            </div>
          )}
        </div>
      ))}
      <button className="btn" onClick={addQuestion}>+ Добавить вопрос</button>
    </div>
  );
}
