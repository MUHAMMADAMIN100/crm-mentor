import { Injectable } from '@nestjs/common';
import { AiContextService, RoleContext } from './ai-context.service';

interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }

@Injectable()
export class AiService {
  constructor(private ctx: AiContextService) {}

  suggestions(role: 'ADMIN' | 'TEACHER' | 'STUDENT'): string[] {
    if (role === 'ADMIN') return [
      'Сколько у нас учителей и учеников?',
      'У кого скоро заканчивается подписка?',
      'Какая общая выручка платформы?',
      'Покажи статистику по курсам',
    ];
    if (role === 'TEACHER') return [
      'Какие домашки сейчас просрочены?',
      'У кого минусовой баланс?',
      'Какие уроки у меня сегодня?',
      'Кто самый активный ученик?',
    ];
    return [
      'Какие у меня домашки на этой неделе?',
      'Какой мой баланс?',
      'Что у меня в расписании?',
      'Как растёт моё дерево мотивации?',
    ];
  }

  async ask(userId: string, question: string, history: ChatMessage[] = []) {
    let context: RoleContext;
    try {
      context = await this.ctx.build(userId);
    } catch (e: any) {
      console.error('[AI] context build failed:', e?.message, e?.stack);
      return { answer: `Не удалось собрать контекст: ${e?.message || e}`, model: 'fallback' };
    }
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: question },
    ];

    // Приоритет: Gemini → Groq → fallback
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const r = await this.callGemini(geminiKey, systemPrompt, history, question);
      if (r) return r;
    }
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const r = await this.callGroq(groqKey, messages);
      if (r) return r;
    }
    return { answer: this.fallback(context, question), model: 'fallback' };
  }

  private async callGroq(apiKey: string, messages: ChatMessage[]) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages,
          temperature: 0.3,
          max_tokens: 800,
        }),
      });
      if (!r.ok) {
        console.error('[AI] Groq error', r.status, await r.text());
        return null;
      }
      const j: any = await r.json();
      const answer = j.choices?.[0]?.message?.content?.trim() || 'Пустой ответ';
      return { answer, model: j.model || 'groq' };
    } catch (e: any) {
      console.error('[AI] Groq exception', e?.message);
      return null;
    }
  }

  private async callGemini(
    apiKey: string,
    systemPrompt: string,
    history: ChatMessage[],
    question: string,
  ) {
    // Список моделей в порядке предпочтения; первая ответившая 200 — используется.
    const models = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL]
      : [
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-001',
          'gemini-1.5-flash',
        ];

    const contents: any[] = [];
    for (const m of history.slice(-8)) {
      if (m.role === 'system') continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: question }] });

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
    });

    let lastErr = '';
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (r.ok) {
          const j: any = await r.json();
          const answer =
            j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim() ||
            'Пустой ответ';
          return { answer, model: `gemini/${model}` };
        }
        const txt = await r.text();
        console.error(`[AI] Gemini ${model} error ${r.status}: ${txt.slice(0, 200)}`);
        lastErr = `${r.status}: ${txt.slice(0, 200)}`;
        // Если 404 — пробуем следующую модель; иначе выходим (например 400/401 не починятся другой моделью)
        if (r.status !== 404) {
          return { answer: `Gemini error ${r.status}: ${txt.slice(0, 400)}`, model: 'gemini-error' };
        }
      } catch (e: any) {
        console.error(`[AI] Gemini ${model} exception`, e?.message);
        lastErr = e?.message || String(e);
      }
    }
    return { answer: `Все модели Gemini недоступны. Последняя ошибка: ${lastErr}`, model: 'gemini-error' };
  }

  private buildSystemPrompt(ctx: RoleContext): string {
    return [
      'Ты — ИИ-помощник CRM-платформы Miz для репетиторов.',
      'Ты получаешь только тот срез данных, который виден текущему пользователю по его роли.',
      `Текущий пользователь: ${ctx.fullName}. Роль: ${ctx.role}.`,
      'Правила:',
      '— Отвечай по-русски, кратко и по делу. Используй маркированные списки и таблицы где уместно.',
      '— Опирайся ТОЛЬКО на JSON-данные ниже. Если данных нет — так и скажи.',
      '— Никогда не выдумывай имена, цифры, даты, балансы.',
      '— Не упоминай сам факт того, что у тебя есть JSON-контекст; говори как будто знаешь систему.',
      `— Тебе нельзя раскрывать информацию, не относящуюся к роли ${ctx.role}.`,
      '',
      'Текущие данные CRM (только то, что доступно этому пользователю):',
      '```json',
      JSON.stringify(ctx.data, null, 2).slice(0, 12000),
      '```',
    ].join('\n');
  }

  // Простой fallback на случай отсутствия ключа Groq — отвечает шаблонно по контексту.
  private fallback(ctx: RoleContext, question: string): string {
    const q = question.toLowerCase();
    const d = ctx.data || {};
    if (ctx.role === 'ADMIN') {
      const s = d.summary || {};
      if (q.includes('учител')) return `На платформе ${s.teachers ?? 0} учителей.`;
      if (q.includes('ученик')) return `На платформе ${s.students ?? 0} учеников.`;
      if (q.includes('выручк') || q.includes('доход')) return `Общая выручка Miz: ${s.totalRevenue ?? 0} ₽.`;
      if (q.includes('подписк')) {
        const exp = d.subscriptionsExpiringIn7d || [];
        return exp.length ? `У ${exp.length} учителей подписка заканчивается в течение 7 дней.` : 'Подписки в ближайшие 7 дней не заканчиваются.';
      }
      return `Сводка платформы: учителей ${s.teachers}, учеников ${s.students}, курсов ${s.courses}, проведено уроков ${s.lessonsCompleted}.`;
    }
    if (ctx.role === 'TEACHER') {
      const s = d.summary || {};
      if (q.includes('сегодня')) return `Сегодня у вас ${s.lessonsToday ?? 0} уроков.`;
      if (q.includes('баланс') || q.includes('долг')) {
        const negs = (d.students || []).filter((x: any) => x.balance < 0);
        if (!negs.length) return 'Все ученики с положительным балансом.';
        return 'Минусовой баланс у:\n' + negs.map((n: any) => `• ${n.fullName}: ${n.balance} ${s.currency}`).join('\n');
      }
      if (q.includes('просроч')) {
        const o = d.homeworkOverdue || [];
        return o.length ? 'Просроченные домашки:\n' + o.map((x: any) => `• ${x.student} — ${x.lesson}`).join('\n') : 'Просрочек нет.';
      }
      return `У вас ${s.totalStudents} учеников, ${s.totalCourses} курсов, ${s.lessonsThisWeek} уроков на этой неделе.`;
    }
    // STUDENT
    const me = d.me || {};
    if (q.includes('баланс')) return `Ваш баланс: ${me.balance ?? 0}.`;
    if (q.includes('расписан') || q.includes('занят')) {
      const u = d.upcomingLessons || [];
      return u.length ? 'Ближайшие занятия:\n' + u.slice(0, 5).map((l: any) => `• ${new Date(l.startAt).toLocaleString('ru-RU')}`).join('\n') : 'Ближайших занятий нет.';
    }
    if (q.includes('домашк') || q.includes('дз')) {
      const h = (d.homeworks || []).filter((x: any) => x.status !== 'COMPLETED');
      return h.length ? 'Актуальные домашки:\n' + h.slice(0, 5).map((x: any) => `• ${x.lesson} — ${x.status}`).join('\n') : 'Все домашки выполнены.';
    }
    if (q.includes('дерев') || q.includes('мотивац')) {
      const t = d.tree || {};
      return `Уровень дерева: ${t.level ?? 0}, выполнено домашек: ${t.completedCount ?? 0}.`;
    }
    return `Вы — ${me.fullName}. Учитель: ${me.teacher}. Курсов: ${(d.courses || []).length}.`;
  }
}
