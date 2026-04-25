import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeworkService {
  constructor(private prisma: PrismaService) {}

  async forStudent(userId: string) {
    return this.prisma.homeworkSubmission.findMany({
      where: { studentId: userId },
      include: { courseLesson: { include: { module: { include: { course: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async forTeacher(teacherId: string) {
    return this.prisma.homeworkSubmission.findMany({
      where: { courseLesson: { module: { course: { teacherId } } } },
      include: {
        student: true,
        courseLesson: { include: { module: { include: { course: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async ensureForLesson(userId: string, courseLessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: courseLessonId } });
    if (!lesson || !lesson.isHomework) return null;
    return this.prisma.homeworkSubmission.upsert({
      where: { courseLessonId_studentId: { courseLessonId, studentId: userId } },
      update: {},
      create: { courseLessonId, studentId: userId, status: 'IN_PROGRESS' },
    });
  }

  /** Recalculate homework status: completed if all homework blocks of lesson are done */
  async recompute(userId: string, courseLessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: courseLessonId },
      include: { blocks: true },
    });
    if (!lesson || !lesson.isHomework) return null;

    const homeworkBlocks = lesson.blocks.filter((b) => b.isHomework);
    if (homeworkBlocks.length === 0) return null;

    const progress = await this.prisma.blockProgress.findMany({
      where: { studentId: userId, blockId: { in: homeworkBlocks.map((b) => b.id) } },
    });
    const allDone = homeworkBlocks.every((b) => progress.find((p) => p.blockId === b.id && p.done));

    const sub = await this.prisma.homeworkSubmission.upsert({
      where: { courseLessonId_studentId: { courseLessonId, studentId: userId } },
      update: {},
      create: { courseLessonId, studentId: userId, status: 'IN_PROGRESS' },
    });

    let next = sub.status;
    let completedAt = sub.completedAt;
    let wasOverdue = sub.wasOverdue;
    const now = new Date();
    const deadline = lesson.deadlineAt;

    if (allDone) {
      next = 'COMPLETED';
      completedAt = now;
      if (deadline && now > deadline) wasOverdue = true;
    } else if (deadline && now > deadline) {
      next = 'OVERDUE';
    } else {
      next = 'IN_PROGRESS';
    }

    return this.prisma.homeworkSubmission.update({
      where: { id: sub.id },
      data: { status: next as any, completedAt, wasOverdue },
    });
  }
}
