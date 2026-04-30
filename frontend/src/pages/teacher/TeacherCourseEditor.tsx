import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { api } from '../../api';
import { Modal } from '../../components/Modal';
import { Loading } from '../../components/Loading';
import { toast, confirmDialog } from '../../store';
import { useT } from '../../i18n';

export function TeacherCourseEditor() {
  const { t } = useT();
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [adding, setAdding] = useState<{ kind: 'module' } | { kind: 'lesson'; mid: string } | null>(null);

  function load() { api.get(`/courses/${id}`).then((r) => setCourse(r.data)); }
  useEffect(() => { load(); api.get('/students').then((r) => setStudents(r.data)); }, [id]);

  if (!course) return <Shell title={t('course.title')}><Loading label={t('loader.course')} /></Shell>;

  return (
    <Shell title={course.title}>
      <div className="flex" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="badge badge-neutral">{course.status}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setAccessOpen(true)}>{t('course.access')}</button>
        <button className="btn btn-primary" onClick={() => setAdding({ kind: 'module' })}>{t('btn.addModule')}</button>
      </div>

      <div className="flex-col">
        {course.modules.map((m: any) => (
          <div className="card" key={m.id}>
            <div className="flex">
              <h3 style={{ margin: 0 }}>{m.title}</h3>
              <div className="spacer" />
              <button className="btn btn-sm" onClick={() => setAdding({ kind: 'lesson', mid: m.id })}>{t('btn.addLesson')}</button>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {m.lessons.map((l: any) => (
                <div key={l.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="flex">
                    <div style={{ fontWeight: 500 }}>{l.title}</div>
                    {l.isHomework && <span className="badge badge-warning">{t('course.dz')}</span>}
                    <div className="spacer" />
                    <button className="btn btn-sm" onClick={() => setEditingLesson(l)}>{t('btn.edit')}</button>
                  </div>
                </div>
              ))}
              {m.lessons.length === 0 && <div className="empty">{t('empty.noLessonsInModule')}</div>}
            </div>
          </div>
        ))}
        {course.modules.length === 0 && <div className="empty">{t('empty.noModules')}</div>}
      </div>

      {accessOpen && (
        <AccessModal courseId={course.id} accesses={course.accesses} students={students} onClose={() => { setAccessOpen(false); load(); }} />
      )}

      {editingLesson && (
        <LessonEditor lesson={editingLesson} onClose={() => { setEditingLesson(null); load(); }} />
      )}

      {adding?.kind === 'module' && (
        <SimpleNameModal title={t('course.newModule')} placeholder={t('course.moduleTitle')} onClose={(name) => {
          setAdding(null);
          if (name) api.post(`/courses/${id}/modules`, { title: name })
            .then(() => { load(); toast.success(t('course.moduleCreated')); })
            .catch(() => toast.error(t('toast.notCreated')));
        }} />
      )}
      {adding?.kind === 'lesson' && (
        <SimpleNameModal title={t('course.newLesson')} placeholder={t('course.lessonTitle')} onClose={(name) => {
          const mid = adding.mid;
          setAdding(null);
          if (name) api.post(`/courses/modules/${mid}/lessons`, { title: name })
            .then(() => { load(); toast.success(t('course.lessonCreated')); })
            .catch(() => toast.error(t('toast.notCreated')));
        }} />
      )}
    </Shell>
  );
}

function SimpleNameModal({ title, placeholder, onClose }: any) {
  const { t } = useT();
  const [name, setName] = useState('');
  return (
    <Modal open onClose={() => onClose(null)} title={title}
      footer={<><button className="btn" onClick={() => onClose(null)}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={() => onClose(name.trim() || null)} disabled={!name.trim()}>{t('btn.create')}</button></>}>
      <div className="field">
        <input className="input" autoFocus placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onClose(name.trim())} />
      </div>
    </Modal>
  );
}

function AccessModal({ courseId, accesses, students, onClose }: any) {
  const { t } = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [paid, setPaid] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  async function grant() {
    try {
      await api.post(`/courses/${courseId}/access`, { studentProfileIds: picked, paid, expiresAt: expiresAt || undefined });
      toast.success(t('course.access.granted'));
      onClose();
    } catch { toast.error(t('toast.notSaved')); }
  }
  async function revoke(sid: string) {
    const ok = await confirmDialog({ title: t('course.access.confirmRevoke'), danger: true, okLabel: t('course.access.closeBtn') });
    if (!ok) return;
    try {
      await api.delete(`/courses/${courseId}/access/${sid}`);
      toast.success(t('course.access.revoked'));
      onClose();
    } catch { toast.error(t('toast.notDeleted')); }
  }
  return (
    <Modal open onClose={onClose} title={t('course.accessTitle')} width={560}
      footer={<><button className="btn" onClick={onClose}>{t('btn.close')}</button><button className="btn btn-primary" onClick={grant} disabled={picked.length === 0}>{t('course.access.openBtn')}</button></>}>
      <div className="field"><label>{t('course.pickStudents')}</label>
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
        <div className="field"><label><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {t('course.paid')}</label></div>
        <div className="field"><label>{t('course.expiresAt')}</label><input type="date" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
      </div>
      <div className="h-divider" />
      <h4 style={{ margin: '0 0 8px' }}>{t('course.currentAccesses')}</h4>
      <div className="list">
        {accesses.map((a: any) => (
          <div key={a.id} className="list-item">
            <div>{a.student.user.fullName} {a.expiresAt && <span className="muted"> · {t('course.untilDate')} {new Date(a.expiresAt).toLocaleDateString()}</span>}</div>
            <button className="btn btn-sm btn-danger" onClick={() => revoke(a.studentId)}>×</button>
          </div>
        ))}
        {accesses.length === 0 && <div className="empty">{t('empty.noAccess')}</div>}
      </div>
    </Modal>
  );
}

function LessonEditor({ lesson, onClose }: any) {
  const { t } = useT();
  const [data, setData] = useState({
    title: lesson.title,
    isHomework: lesson.isHomework,
    deadlineMode: lesson.deadlineMode,
    deadlineAt: lesson.deadlineAt ? lesson.deadlineAt.slice(0, 16) : '',
    aiHelper: lesson.aiHelper,
  });
  const [blocks, setBlocks] = useState<any[]>(lesson.blocks || []);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveLesson() {
    setSaving(true);
    try {
      await api.patch(`/courses/lessons/${lesson.id}`, {
        ...data,
        deadlineAt: data.deadlineMode === 'MANUAL' && data.deadlineAt ? new Date(data.deadlineAt).toISOString() : null,
      });
      toast.success(t('course.lessonSaved'));
      onClose();
    } catch { toast.error(t('toast.notSaved')); } finally { setSaving(false); }
  }
  async function addBlock(type: string, payload: any) {
    try {
      const b = await api.post(`/courses/lessons/${lesson.id}/blocks`, { type, ...payload });
      setBlocks([...blocks, b.data]);
      setAddingType(null);
      toast.success(t('course.blockAdded'));
    } catch { toast.error(t('toast.notCreated')); }
  }
  async function updateBlock(blockId: string, payload: any) {
    try {
      const b = await api.patch(`/courses/blocks/${blockId}`, payload);
      setBlocks(blocks.map((x) => x.id === blockId ? b.data : x));
      setEditingBlock(null);
      toast.success(t('btn.save'));
    } catch { toast.error(t('toast.notSaved')); }
  }
  async function deleteBlock(bid: string) {
    const ok = await confirmDialog({ title: t('course.confirmDeleteBlock'), danger: true, okLabel: t('btn.delete') });
    if (!ok) return;
    try {
      await api.delete(`/courses/blocks/${bid}`);
      setBlocks(blocks.filter((x) => x.id !== bid));
      toast.success(t('course.blockDeleted'));
    } catch { toast.error(t('toast.notDeleted')); }
  }
  async function toggleBlockHomework(b: any) {
    try {
      await api.patch(`/courses/blocks/${b.id}`, { isHomework: !b.isHomework });
      setBlocks(blocks.map((x) => x.id === b.id ? { ...x, isHomework: !x.isHomework } : x));
    } catch { toast.error(t('toast.notUpdated')); }
  }

  return (
    <>
      <Modal open onClose={onClose} title={t('course.lessonEdit')} width={680}
        footer={<><button className="btn" onClick={onClose}>{t('btn.close')}</button><button className="btn btn-primary" onClick={saveLesson} disabled={saving}>{saving ? t('status.saving') : t('btn.save')}</button></>}>
        <div className="field"><label>{t('course.title2')}</label><input className="input" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label><input type="checkbox" checked={data.isHomework} onChange={(e) => setData({ ...data, isHomework: e.target.checked })} /> {t('course.isHomework')}</label></div>
          <div className="field"><label><input type="checkbox" checked={data.aiHelper} onChange={(e) => setData({ ...data, aiHelper: e.target.checked })} /> {t('course.aiHelper')}</label></div>
        </div>
        {data.isHomework && (
          <div className="row">
            <div className="field"><label>{t('course.deadline')}</label>
              <select className="select" value={data.deadlineMode} onChange={(e) => setData({ ...data, deadlineMode: e.target.value })}>
                <option value="NEXT_LESSON">{t('course.deadlineNext')}</option>
                <option value="MANUAL">{t('course.deadlineManual')}</option>
                <option value="NONE">{t('course.deadlineNone')}</option>
              </select>
            </div>
            {data.deadlineMode === 'MANUAL' && (
              <div className="field"><label>{t('course.deadlineDate')}</label><input type="datetime-local" className="input" value={data.deadlineAt} onChange={(e) => setData({ ...data, deadlineAt: e.target.value })} /></div>
            )}
          </div>
        )}

        <div className="h-divider" />
        <h4 style={{ margin: '0 0 8px' }}>{t('course.lessonBlocks')}</h4>
        <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {blocks.map((b) => (
            <div key={b.id} className="list-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="badge badge-neutral">{t(`block.${b.type}` as any) || b.type}</span>{' '}
                <span style={{ fontWeight: 500 }}>{blockTitleOf(b, t)}</span>
              </div>
              <div className="flex">
                <label className="muted" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={b.isHomework} onChange={() => toggleBlockHomework(b)} /> {t('course.dz')}
                </label>
                <button className="btn btn-sm" onClick={() => setEditingBlock(b)}>{t('btn.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteBlock(b.id)}>×</button>
              </div>
            </div>
          ))}
          {blocks.length === 0 && <div className="empty">{t('empty.noBlocks')}</div>}
        </div>

        <div className="h-divider" />
        <div className="flex" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => setAddingType('VIDEO')}>{t('btn.addVideo')}</button>
          <button className="btn btn-sm" onClick={() => setAddingType('TEXT')}>{t('btn.addText')}</button>
          <button className="btn btn-sm" onClick={() => setAddingType('FILE')}>{t('btn.addFile')}</button>
          <button className="btn btn-sm" onClick={() => setAddingType('QUIZ')}>{t('btn.addQuiz')}</button>
          <button className="btn btn-sm" onClick={() => setAddingType('WRITTEN')}>{t('btn.addWritten')}</button>
        </div>
      </Modal>

      {addingType && (
        <BlockFormModal
          type={addingType}
          onCancel={() => setAddingType(null)}
          onSave={(payload) => addBlock(addingType, payload)}
        />
      )}
      {editingBlock && (
        <BlockFormModal
          type={editingBlock.type}
          initial={editingBlock}
          onCancel={() => setEditingBlock(null)}
          onSave={(payload) => updateBlock(editingBlock.id, payload)}
        />
      )}
    </>
  );
}

function blockTitleOf(b: any, t: any) {
  if (b.textTitle) return b.textTitle;
  if (b.writtenPrompt) return b.writtenPrompt.slice(0, 60);
  if (b.videoUrls?.[0]) return b.videoUrls[0];
  if (b.fileUrls?.length) return `${b.fileUrls.length}`;
  if (b.quizKind) {
    const cnt = b.quizPayload && typeof b.quizPayload === 'object' ? Object.keys(b.quizPayload).length : 0;
    return `${t('block.QUIZ')} · ${cnt}`;
  }
  return '';
}

/* ====================================================================
   BlockFormModal — single self-contained modal that adapts to block type.
   Replaces the old inline "Новый блок" card stacked inside lesson editor.
   ==================================================================== */

function BlockFormModal({ type, initial, onCancel, onSave }: any) {
  const { t } = useT();

  if (type === 'VIDEO') return <VideoBlockForm initial={initial} onCancel={onCancel} onSave={onSave} t={t} />;
  if (type === 'TEXT') return <TextBlockForm initial={initial} onCancel={onCancel} onSave={onSave} t={t} />;
  if (type === 'FILE') return <FileBlockForm initial={initial} onCancel={onCancel} onSave={onSave} t={t} />;
  if (type === 'WRITTEN') return <WrittenBlockForm initial={initial} onCancel={onCancel} onSave={onSave} t={t} />;
  if (type === 'QUIZ') return <QuizBlockForm initial={initial} onCancel={onCancel} onSave={onSave} t={t} />;
  return null;
}

function VideoBlockForm({ initial, onCancel, onSave, t }: any) {
  const [urls, setUrls] = useState((initial?.videoUrls || []).join(' '));
  function submit() {
    const arr = urls.split(/\s+/).filter(Boolean);
    if (arr.length === 0) return toast.warning(t('block.video.urls'));
    onSave({ videoUrls: arr });
  }
  return (
    <Modal open onClose={onCancel} title={`${initial ? t('btn.edit') : t('block.newBlock')}: ${t('block.VIDEO')}`}
      footer={<><button className="btn" onClick={onCancel}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={submit}>{initial ? t('btn.save') : t('btn.add')}</button></>}>
      <div className="field"><label>{t('block.video.urls')}</label>
        <textarea className="textarea" value={urls} placeholder="https://youtube.com/watch?v=…"
          onChange={(e) => setUrls(e.target.value)} />
      </div>
    </Modal>
  );
}

function TextBlockForm({ initial, onCancel, onSave, t }: any) {
  const [textTitle, setTextTitle] = useState(initial?.textTitle || '');
  const [textBody, setTextBody] = useState(initial?.textBody || '');
  const [miniQ, setMiniQ] = useState(initial?.miniQuizQuestion || '');
  const [miniA, setMiniA] = useState<string>(
    initial?.miniQuizAnswer === true ? 'true' : initial?.miniQuizAnswer === false ? 'false' : '',
  );
  function submit() {
    if (!textTitle && !textBody) return toast.warning(t('block.text.body'));
    onSave({
      textTitle: textTitle || null,
      textBody: textBody || null,
      miniQuizQuestion: miniQ || null,
      miniQuizAnswer: miniA === '' ? null : miniA === 'true',
    });
  }
  return (
    <Modal open onClose={onCancel} title={`${initial ? t('btn.edit') : t('block.newBlock')}: ${t('block.TEXT')}`} width={620}
      footer={<><button className="btn" onClick={onCancel}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={submit}>{initial ? t('btn.save') : t('btn.add')}</button></>}>
      <div className="field"><label>{t('block.text.heading')}</label><input className="input" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} /></div>
      <div className="field"><label>{t('block.text.body')}</label><textarea className="textarea" style={{ minHeight: 140 }} value={textBody} onChange={(e) => setTextBody(e.target.value)} /></div>
      <div className="field"><label>{t('block.text.miniQuestion')}</label>
        <input className="input" placeholder={t('block.text.statement')} value={miniQ} onChange={(e) => setMiniQ(e.target.value)} /></div>
      <div className="field"><label>{t('block.text.rightAnswer')}</label>
        <select className="select" value={miniA} onChange={(e) => setMiniA(e.target.value)}>
          <option value="">{t('block.text.noCheck')}</option>
          <option value="true">{t('btn.true')}</option>
          <option value="false">{t('btn.false')}</option>
        </select>
      </div>
    </Modal>
  );
}

function FileBlockForm({ initial, onCancel, onSave, t }: any) {
  const [urls, setUrls] = useState((initial?.fileUrls || []).join(' '));
  function submit() {
    const arr = urls.split(/\s+/).filter(Boolean).slice(0, 5);
    if (arr.length === 0) return toast.warning(t('block.file.urls'));
    onSave({ fileUrls: arr });
  }
  return (
    <Modal open onClose={onCancel} title={`${initial ? t('btn.edit') : t('block.newBlock')}: ${t('block.FILE')}`}
      footer={<><button className="btn" onClick={onCancel}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={submit}>{initial ? t('btn.save') : t('btn.add')}</button></>}>
      <div className="field"><label>{t('block.file.urls')}</label>
        <textarea className="textarea" value={urls} onChange={(e) => setUrls(e.target.value)} /></div>
    </Modal>
  );
}

function WrittenBlockForm({ initial, onCancel, onSave, t }: any) {
  const [prompt, setPrompt] = useState(initial?.writtenPrompt || '');
  const [hint, setHint] = useState(initial?.writtenHint || '');
  function submit() {
    if (!prompt.trim()) return toast.warning(t('block.written.task'));
    onSave({ writtenPrompt: prompt, writtenHint: hint || null });
  }
  return (
    <Modal open onClose={onCancel} title={`${initial ? t('btn.edit') : t('block.newBlock')}: ${t('block.WRITTEN')}`} width={620}
      footer={<><button className="btn" onClick={onCancel}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={submit}>{initial ? t('btn.save') : t('btn.add')}</button></>}>
      <div className="field"><label>{t('block.written.task')}</label>
        <textarea className="textarea" placeholder={t('block.written.taskPlaceholder')} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
      <div className="field"><label>{t('block.written.hint')}</label>
        <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} /></div>
    </Modal>
  );
}

/* ====================================================================
   QUIZ BLOCK FORM — fixed type-switching, dedicated forms per kind.

   Storage shape on the server (matches scoreQuiz on backend):
     CHOICE / PICK_RIGHT:
       payload[k] = { q, options }
       correct[k] = "the right option text"
     FILL_SENT / FILL_GAPS:
       payload[k] = { q }
       correct[k] = "exact answer"
     MATCHING:
       payload[k] = { q, left, right }    where right is the shuffled
                                          options list shown to student
       correct[k] = right value that matches the left prompt
   ==================================================================== */

type QuizKind = 'CHOICE' | 'PICK_RIGHT' | 'FILL_SENT' | 'FILL_GAPS' | 'MATCHING';

interface ChoiceQ { q: string; options: string[]; correctIdx: number; }
interface TextQ { q: string; answer: string; }
interface MatchQ { q: string; left: string; right: string[]; correctRight: string; }

function QuizBlockForm({ initial, onCancel, onSave, t }: any) {
  // Decode initial value back to local state structure (or seed defaults).
  const initKind: QuizKind = (initial?.quizKind as QuizKind) || 'CHOICE';
  const [kind, setKind] = useState<QuizKind>(initKind);

  // Per-kind question lists (keep separately so switching doesn't lose data)
  const [choiceQs, setChoiceQs] = useState<ChoiceQ[]>(() => decodeChoice(initial, initKind));
  const [textQs, setTextQs] = useState<TextQ[]>(() => decodeText(initial, initKind));
  const [matchQs, setMatchQs] = useState<MatchQ[]>(() => decodeMatch(initial, initKind));

  function changeKind(k: QuizKind) {
    // Switching kind keeps all per-kind drafts; user can flip back without losing work.
    setKind(k);
    // If lists for the target kind are empty, seed one starter question.
    if ((k === 'CHOICE' || k === 'PICK_RIGHT') && choiceQs.length === 0) {
      setChoiceQs([{ q: '', options: ['', ''], correctIdx: 0 }]);
    }
    if ((k === 'FILL_SENT' || k === 'FILL_GAPS') && textQs.length === 0) {
      setTextQs([{ q: '', answer: '' }]);
    }
    if (k === 'MATCHING' && matchQs.length === 0) {
      setMatchQs([{ q: '', left: '', right: ['', ''], correctRight: '' }]);
    }
  }

  function submit() {
    let payload: Record<string, any> = {};
    let correct: Record<string, any> = {};
    if (kind === 'CHOICE' || kind === 'PICK_RIGHT') {
      if (choiceQs.length === 0) return toast.warning(t('quiz.fillAll'));
      choiceQs.forEach((q, i) => {
        const opts = q.options.map((o) => o.trim()).filter(Boolean);
        if (!q.q.trim() || opts.length < 2) return;
        const key = `q${i + 1}`;
        payload[key] = { q: q.q, options: opts };
        correct[key] = opts[Math.min(q.correctIdx, opts.length - 1)];
      });
    } else if (kind === 'FILL_SENT' || kind === 'FILL_GAPS') {
      if (textQs.length === 0) return toast.warning(t('quiz.fillAll'));
      textQs.forEach((q, i) => {
        if (!q.q.trim() || !q.answer.trim()) return;
        const key = `q${i + 1}`;
        payload[key] = { q: q.q };
        correct[key] = q.answer.trim();
      });
    } else if (kind === 'MATCHING') {
      if (matchQs.length === 0) return toast.warning(t('quiz.fillAll'));
      matchQs.forEach((q, i) => {
        const right = q.right.map((r) => r.trim()).filter(Boolean);
        if (!q.left.trim() || !q.correctRight.trim() || right.length < 2) return;
        const key = `q${i + 1}`;
        payload[key] = { q: q.q || q.left, left: q.left, right };
        correct[key] = q.correctRight.trim();
      });
    }
    if (Object.keys(payload).length === 0) {
      toast.warning(t('quiz.fillAll'));
      return;
    }
    onSave({ quizKind: kind, quizPayload: payload, quizCorrect: correct });
  }

  const isChoice = kind === 'CHOICE' || kind === 'PICK_RIGHT';
  const isText = kind === 'FILL_SENT' || kind === 'FILL_GAPS';
  const isMatch = kind === 'MATCHING';

  return (
    <Modal open onClose={onCancel} title={`${initial ? t('btn.edit') : t('block.newBlock')}: ${t('block.QUIZ')}`} width={680}
      footer={<><button className="btn" onClick={onCancel}>{t('btn.cancel')}</button><button className="btn btn-primary" onClick={submit}>{initial ? t('btn.save') : t('btn.add')}</button></>}>
      <div className="field"><label>{t('quiz.kindLabel')}</label>
        <select className="select" value={kind} onChange={(e) => changeKind(e.target.value as QuizKind)}>
          <option value="CHOICE">{t('quiz.kind.CHOICE')}</option>
          <option value="PICK_RIGHT">{t('quiz.kind.PICK_RIGHT')}</option>
          <option value="FILL_SENT">{t('quiz.kind.FILL_SENT')}</option>
          <option value="FILL_GAPS">{t('quiz.kind.FILL_GAPS')}</option>
          <option value="MATCHING">{t('quiz.kind.MATCHING')}</option>
        </select>
      </div>
      <h4 style={{ margin: '14px 0 8px', fontSize: 13, color: 'var(--text-soft)' }}>{t('quiz.questions')}</h4>

      {isChoice && (
        <ChoiceQuizEditor questions={choiceQs} setQuestions={setChoiceQs} t={t} />
      )}
      {isText && (
        <TextQuizEditor questions={textQs} setQuestions={setTextQs} t={t} />
      )}
      {isMatch && (
        <MatchQuizEditor questions={matchQs} setQuestions={setMatchQs} t={t} />
      )}
    </Modal>
  );
}

function ChoiceQuizEditor({ questions, setQuestions, t }: any) {
  return (
    <>
      {questions.map((q: ChoiceQ, idx: number) => (
        <div key={idx} className="qb-question">
          <div className="qh">
            <div className="qn">{idx + 1}</div>
            <input className="input" placeholder={t('quiz.questionText')} value={q.q}
              onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, q: e.target.value } : x))} />
            {questions.length > 1 && (
              <button className="btn btn-sm btn-danger" aria-label={t('quiz.removeQuestion')}
                onClick={() => setQuestions(questions.filter((_: any, i: number) => i !== idx))}>×</button>
            )}
          </div>
          <div className="qb-options">
            {q.options.map((opt: string, oi: number) => (
              <div key={oi} className="qb-option">
                <button type="button" title={t('quiz.markCorrect')}
                  className={`btn-correct ${q.correctIdx === oi ? 'is-correct' : ''}`}
                  onClick={() => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, correctIdx: oi } : x))}>
                  {q.correctIdx === oi ? '✓' : ''}
                </button>
                <input className="input" placeholder={`${t('quiz.option')} ${oi + 1}`} value={opt}
                  onChange={(e) => setQuestions(questions.map((x: any, i: number) => {
                    if (i !== idx) return x;
                    const opts = [...x.options]; opts[oi] = e.target.value; return { ...x, options: opts };
                  }))} />
                {q.options.length > 2 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setQuestions(questions.map((x: any, i: number) => {
                    if (i !== idx) return x;
                    const opts = x.options.filter((_: any, j: number) => j !== oi);
                    return { ...x, options: opts, correctIdx: x.correctIdx >= opts.length ? 0 : x.correctIdx };
                  }))}>×</button>
                )}
              </div>
            ))}
            <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}
              onClick={() => setQuestions(questions.map((x: any, i: number) =>
                i === idx ? { ...x, options: [...x.options, ''] } : x))}>{t('btn.addOption')}</button>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => setQuestions([...questions, { q: '', options: ['', ''], correctIdx: 0 }])}>{t('btn.addQuestion')}</button>
    </>
  );
}

function TextQuizEditor({ questions, setQuestions, t }: any) {
  return (
    <>
      {questions.map((q: TextQ, idx: number) => (
        <div key={idx} className="qb-question">
          <div className="qh">
            <div className="qn">{idx + 1}</div>
            <input className="input" placeholder={t('quiz.questionText')} value={q.q}
              onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, q: e.target.value } : x))} />
            {questions.length > 1 && (
              <button className="btn btn-sm btn-danger" aria-label={t('quiz.removeQuestion')}
                onClick={() => setQuestions(questions.filter((_: any, i: number) => i !== idx))}>×</button>
            )}
          </div>
          <div className="field" style={{ marginTop: 6 }}>
            <label>{t('block.text.rightAnswer')}</label>
            <input className="input" placeholder={t('quiz.exactAnswer')} value={q.answer}
              onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, answer: e.target.value } : x))} />
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => setQuestions([...questions, { q: '', answer: '' }])}>{t('btn.addQuestion')}</button>
    </>
  );
}

function MatchQuizEditor({ questions, setQuestions, t }: any) {
  return (
    <>
      {questions.map((q: MatchQ, idx: number) => (
        <div key={idx} className="qb-question">
          <div className="qh">
            <div className="qn">{idx + 1}</div>
            <input className="input" placeholder={t('quiz.questionText')} value={q.q}
              onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, q: e.target.value } : x))} />
            {questions.length > 1 && (
              <button className="btn btn-sm btn-danger" aria-label={t('quiz.removeQuestion')}
                onClick={() => setQuestions(questions.filter((_: any, i: number) => i !== idx))}>×</button>
            )}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Left</label>
              <input className="input" value={q.left}
                onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, left: e.target.value } : x))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('block.text.rightAnswer')}</label>
              <input className="input" value={q.correctRight}
                onChange={(e) => setQuestions(questions.map((x: any, i: number) => i === idx ? { ...x, correctRight: e.target.value } : x))} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Right options</label>
            {q.right.map((r: string, ri: number) => (
              <div key={ri} className="qb-option" style={{ marginBottom: 4 }}>
                <input className="input" value={r}
                  onChange={(e) => setQuestions(questions.map((x: any, i: number) => {
                    if (i !== idx) return x;
                    const right = [...x.right]; right[ri] = e.target.value; return { ...x, right };
                  }))} />
                {q.right.length > 2 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setQuestions(questions.map((x: any, i: number) => {
                    if (i !== idx) return x;
                    return { ...x, right: x.right.filter((_: any, j: number) => j !== ri) };
                  }))}>×</button>
                )}
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setQuestions(questions.map((x: any, i: number) =>
              i === idx ? { ...x, right: [...x.right, ''] } : x))}>{t('btn.addOption')}</button>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => setQuestions([...questions, { q: '', left: '', right: ['', ''], correctRight: '' }])}>{t('btn.addQuestion')}</button>
    </>
  );
}

/* ===== decoders for editing existing quiz ===== */
function decodeChoice(initial: any, kind: QuizKind): ChoiceQ[] {
  if (!initial || (kind !== 'CHOICE' && kind !== 'PICK_RIGHT')) return [];
  const payload = (initial.quizPayload || {}) as Record<string, any>;
  const correct = (initial.quizCorrect || {}) as Record<string, any>;
  return Object.entries(payload).map(([k, v]: any) => {
    const options = Array.isArray(v.options) ? v.options : [];
    const right = correct[k];
    return {
      q: v.q || '',
      options: options.length ? options : ['', ''],
      correctIdx: Math.max(0, options.indexOf(right)),
    };
  });
}
function decodeText(initial: any, kind: QuizKind): TextQ[] {
  if (!initial || (kind !== 'FILL_SENT' && kind !== 'FILL_GAPS')) return [];
  const payload = (initial.quizPayload || {}) as Record<string, any>;
  const correct = (initial.quizCorrect || {}) as Record<string, any>;
  return Object.entries(payload).map(([k, v]: any) => ({ q: v.q || '', answer: String(correct[k] ?? '') }));
}
function decodeMatch(initial: any, kind: QuizKind): MatchQ[] {
  if (!initial || kind !== 'MATCHING') return [];
  const payload = (initial.quizPayload || {}) as Record<string, any>;
  const correct = (initial.quizCorrect || {}) as Record<string, any>;
  return Object.entries(payload).map(([k, v]: any) => ({
    q: v.q || '',
    left: v.left || '',
    right: Array.isArray(v.right) && v.right.length ? v.right : ['', ''],
    correctRight: String(correct[k] ?? ''),
  }));
}
