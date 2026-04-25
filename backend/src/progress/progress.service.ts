import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HomeworkService } from '../homework/homework.service';
import { TreeService } from '../tree/tree.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private homework: HomeworkService,
    private tree: TreeService,
  ) {}

  async markBlockDone(userId: string, blockId: string, data?: any) {
    const block = await this.prisma.contentBlock.findUnique({
      where: { id: blockId },
      include: { courseLesson: true },
    });
    if (!block) throw new NotFoundException();
    const bp = await this.prisma.blockProgress.upsert({
      where: { blockId_studentId: { blockId, studentId: userId } },
      update: { done: true, doneAt: new Date(), data: data ?? undefined },
      create: { blockId, studentId: userId, done: true, doneAt: new Date(), data: data ?? null },
    });
    await this.afterBlockChange(userId, block.courseLesson.id);
    return bp;
  }

  async submitQuiz(userId: string, blockId: string, answers: any) {
    const block = await this.prisma.contentBlock.findUnique({
      where: { id: blockId },
      include: { courseLesson: true },
    });
    if (!block) throw new NotFoundException();
    const correct = (block.quizCorrect as any) || {};
    const score = this.scoreQuiz(answers, correct);
    const sub = await this.prisma.quizSubmission.create({
      data: { blockId, studentId: userId, answers, score },
    });
    await this.prisma.blockProgress.upsert({
      where: { blockId_studentId: { blockId, studentId: userId } },
      update: { done: true, doneAt: new Date(), data: { score, answers } },
      create: { blockId, studentId: userId, done: true, doneAt: new Date(), data: { score, answers } },
    });
    await this.afterBlockChange(userId, block.courseLesson.id);
    return { ...sub, correct };
  }

  private scoreQuiz(answers: any, correct: any): number {
    if (!answers || !correct) return 0;
    const keys = Object.keys(correct);
    if (keys.length === 0) return 0;
    let ok = 0;
    for (const k of keys) {
      const a = answers[k];
      const c = correct[k];
      if (Array.isArray(c)) {
        if (Array.isArray(a) && a.length === c.length && a.every((v) => c.includes(v))) ok++;
      } else if (typeof c === 'object' && c !== null) {
        if (JSON.stringify(a) === JSON.stringify(c)) ok++;
      } else {
        if (String(a).trim().toLowerCase() === String(c).trim().toLowerCase()) ok++;
      }
    }
    return ok / keys.length;
  }

  async myProgress(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        courseAccesses: {
          include: {
            course: {
              include: {
                modules: { include: { lessons: { include: { blocks: true } } } },
              },
            },
          },
        },
      },
    });
    if (!sp) return null;
    const blockIds: string[] = [];
    sp.courseAccesses.forEach((a) =>
      a.course.modules.forEach((m) => m.lessons.forEach((l) => l.blocks.forEach((b) => blockIds.push(b.id)))),
    );
    const progress = await this.prisma.blockProgress.findMany({
      where: { studentId: userId, blockId: { in: blockIds } },
    });
    const byType = { VIDEO: [0, 0], TEXT: [0, 0], FILE: [0, 0], QUIZ: [0, 0], WRITTEN: [0, 0] } as Record<string, [number, number]>;
    let lessonsTotal = 0;
    let lessonsDone = 0;
    sp.courseAccesses.forEach((a) =>
      a.course.modules.forEach((m) =>
        m.lessons.forEach((l) => {
          lessonsTotal++;
          let allDone = l.blocks.length > 0;
          l.blocks.forEach((b) => {
            byType[b.type][1]++;
            const p = progress.find((x) => x.blockId === b.id && x.done);
            if (p) byType[b.type][0]++;
            else allDone = false;
          });
          if (allDone) lessonsDone++;
        }),
      ),
    );
    return { byType, lessons: [lessonsDone, lessonsTotal] };
  }

  private async afterBlockChange(userId: string, courseLessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: courseLessonId } });
    if (!lesson?.isHomework) return;
    const before = await this.prisma.homeworkSubmission.findUnique({
      where: { courseLessonId_studentId: { courseLessonId, studentId: userId } },
    });
    const after = await this.homework.recompute(userId, courseLessonId);
    if (!after) return;
    if (after.status === 'COMPLETED' && before?.status !== 'COMPLETED') {
      const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
      if (sp) {
        await this.tree.onHomeworkCompleted(sp.id);
        await this.prisma.notification.create({
          data: { userId: sp.teacherId, kind: 'HOMEWORK', title: 'Ученик выполнил домашку', body: lesson.title },
        });
      }
    }
  }
}
