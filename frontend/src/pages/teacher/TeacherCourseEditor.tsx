import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';

export function TeacherCourseEditor() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [editingLesson, setEditingLesson] = useState<any>(null);

  function load() { api.get(`/courses/${id}`).then((r) => setCourse(r.data)); }
  useEffect(() => { load(); api.get('/students').then((r) => setStudents(r.data)); }, [id]);

  if (!course) return <Shell title="Курс"><div>Загрузка…</div></Shell>;

  async function addModule() {
    const title = prompt('Название модуля');
    if (!title) return;
    await api.post(`/courses/${id}/modules`, { title }); load();
  }
  async function addLesson(mid: string) {
    const title = prompt('Название урока');
    if (!title) return;
    await api.post(`/courses/modules/${mid}/lessons`, { title }); load();
  }

  return (
    <Shell title={course.title}>
      <div className="flex" style={{ marginBottom: 16 }}>
        <span className="badge badge-neutral">{course.status}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setAccessOpen(true)}>Доступы</button>
        <button className="btn btn-primary" onClick={addModule}>+ Модуль</button>
      </div>

      <div className="flex-col">
        {course.modules.map((m: any) => (
          <div className="card" key={m.id}>
            <div className="flex">
              <h3 style={{ margin: 0 }}>{m.title}</h3>
              <div className="spacer" />
              <button className="btn btn-sm" onClick={() => addLesson(m.id)}>+ Урок</button>
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
    </Shell>
  );
}

function AccessModal({ courseId, accesses, students, onClose }: any) {
  const [picked, setPicked] = useState<string[]>([]);
  const [paid, setPaid] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  async function grant() {
    await api.post(`/courses/${courseId}/access`, { studentProfileIds: picked, paid, expiresAt: expiresAt || undefined });
    onClose();
  }
  async function revoke(sid: string) {
    if (!confirm('Закрыть доступ?')) return;
    await api.delete(`/courses/${courseId}/access/${sid}`);
    onClose();
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

  async function saveLesson() {
    await api.patch(`/courses/lessons/${lesson.id}`, {
      ...data,
      deadlineAt: data.deadlineMode === 'MANUAL' && data.deadlineAt ? new Date(data.deadlineAt).toISOString() : null,
    });
    onClose();
  }
  async function addBlock(type: string, payload: any) {
    const b = await api.post(`/courses/lessons/${lesson.id}/blocks`, { type, ...payload });
    setBlocks([...blocks, b.data]);
    setAdding(null);
  }
  async function deleteBlock(bid: string) {
    if (!confirm('Удалить блок?')) return;
    await api.delete(`/courses/blocks/${bid}`);
    setBlocks(blocks.filter((x) => x.id !== bid));
  }
  async function toggleBlockHomework(b: any) {
    await api.patch(`/courses/blocks/${b.id}`, { isHomework: !b.isHomework });
    setBlocks(blocks.map((x) => x.id === b.id ? { ...x, isHomework: !x.isHomework } : x));
  }

  return (
    <Modal open onClose={onClose} title="Редактирование урока" width={680}
      footer={<><button className="btn" onClick={onClose}>Закрыть</button><button className="btn btn-primary" onClick={saveLesson}>Сохранить урок</button></>}>
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
              <span style={{ fontWeight: 500 }}>{b.textTitle || b.writtenPrompt || (b.videoUrls?.[0]) || (b.fileUrls?.length ? `${b.fileUrls.length} файл(ов)` : b.quizKind || 'Блок')}</span>
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
      <div className="flex">
        <button className="btn btn-sm" onClick={() => setAdding('VIDEO')}>+ Видео</button>
        <button className="btn btn-sm" onClick={() => setAdding('TEXT')}>+ Текст</button>
        <button className="btn btn-sm" onClick={() => setAdding('FILE')}>+ Файлы</button>
        <button className="btn btn-sm" onClick={() => setAdding('QUIZ')}>+ Квиз</button>
        <button className="btn btn-sm" onClick={() => setAdding('WRITTEN')}>+ Письменное</button>
      </div>

      {adding && <BlockForm type={adding} onCancel={() => setAdding(null)} onAdd={(payload) => addBlock(adding, payload)} />}
    </Modal>
  );
}

function BlockForm({ type, onCancel, onAdd }: any) {
  const [state, setState] = useState<any>({});

  function update(k: string, v: any) { setState({ ...state, [k]: v }); }

  function submit() {
    if (type === 'VIDEO') onAdd({ videoUrls: (state.urls || '').split(/\s+/).filter(Boolean) });
    else if (type === 'TEXT') onAdd({ textTitle: state.textTitle, textBody: state.textBody, miniQuizQuestion: state.miniQuizQuestion || null, miniQuizAnswer: state.miniQuizAnswer ?? null });
    else if (type === 'FILE') onAdd({ fileUrls: (state.urls || '').split(/\s+/).filter(Boolean).slice(0, 5) });
    else if (type === 'WRITTEN') onAdd({ writtenPrompt: state.prompt, writtenHint: state.hint });
    else if (type === 'QUIZ') onAdd({ quizKind: state.quizKind || 'CHOICE', quizPayload: tryJson(state.payload), quizCorrect: tryJson(state.correct) });
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Новый блок: {type}</h3>
      {type === 'VIDEO' && <div className="field"><label>URL видео (через пробел)</label><textarea className="textarea" onChange={(e) => update('urls', e.target.value)} /></div>}
      {type === 'TEXT' && (<>
        <div className="field"><label>Заголовок</label><input className="input" onChange={(e) => update('textTitle', e.target.value)} /></div>
        <div className="field"><label>Текст</label><textarea className="textarea" onChange={(e) => update('textBody', e.target.value)} /></div>
        <div className="field"><label>Мини-квиз (true/false)</label><input className="input" placeholder="Вопрос" onChange={(e) => update('miniQuizQuestion', e.target.value)} /></div>
        <div className="field"><label>Правильный ответ</label>
          <select className="select" onChange={(e) => update('miniQuizAnswer', e.target.value === 'true')}>
            <option value="">—</option><option value="true">Истина</option><option value="false">Ложь</option>
          </select>
        </div>
      </>)}
      {type === 'FILE' && <div className="field"><label>URL файлов (через пробел, до 5)</label><textarea className="textarea" onChange={(e) => update('urls', e.target.value)} /></div>}
      {type === 'WRITTEN' && (<>
        <div className="field"><label>Задание</label><textarea className="textarea" onChange={(e) => update('prompt', e.target.value)} /></div>
        <div className="field"><label>Подсказка (показ. бледным текстом ученику)</label><input className="input" onChange={(e) => update('hint', e.target.value)} /></div>
      </>)}
      {type === 'QUIZ' && (<>
        <div className="field"><label>Тип квиза</label>
          <select className="select" onChange={(e) => update('quizKind', e.target.value)}>
            <option value="CHOICE">Тест с вариантами</option>
            <option value="MATCHING">Сопоставление</option>
            <option value="FILL_SENT">Заполнить предложения</option>
            <option value="PICK_RIGHT">Выбрать правильный</option>
            <option value="FILL_GAPS">Заполнить пропуски</option>
          </select>
        </div>
        <div className="field"><label>Содержимое (JSON: {`{"q1":{"q":"...","options":["a","b"]}}`})</label>
          <textarea className="textarea" onChange={(e) => update('payload', e.target.value)} />
        </div>
        <div className="field"><label>Правильные ответы (JSON: {`{"q1":"a"}`})</label>
          <textarea className="textarea" onChange={(e) => update('correct', e.target.value)} />
        </div>
      </>)}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>Отмена</button>
        <button className="btn btn-primary" onClick={submit}>Добавить</button>
      </div>
    </div>
  );
}
function tryJson(s: string) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
