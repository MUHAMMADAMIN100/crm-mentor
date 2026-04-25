import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // ====== TEACHER ======
  listForTeacher(teacherId: string) {
    return this.prisma.course.findMany({
      where: { teacherId },
      include: { _count: { select: { modules: true, accesses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(teacherId: string, data: { title: string; description?: string; category?: string; price?: number }) {
    return this.prisma.course.create({
      data: { teacherId, ...data },
    });
  }

  async getOne(teacherId: string, id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          include: { lessons: { include: { blocks: true } } },
          orderBy: { position: 'asc' },
        },
        accesses: { include: { student: { include: { user: true } } } },
      },
    });
    if (!c) throw new NotFoundException();
    if (c.teacherId !== teacherId) throw new ForbiddenException();
    return c;
  }

  async update(teacherId: string, id: string, data: any) {
    await this.assertOwn(teacherId, id);
    return this.prisma.course.update({ where: { id }, data });
  }

  async remove(teacherId: string, id: string) {
    await this.assertOwn(teacherId, id);
    return this.prisma.course.delete({ where: { id } });
  }

  // ====== MODULES ======
  async createModule(teacherId: string, courseId: string, title: string) {
    await this.assertOwn(teacherId, courseId);
    const last = await this.prisma.module.findFirst({ where: { courseId }, orderBy: { position: 'desc' } });
    return this.prisma.module.create({
      data: { courseId, title, position: (last?.position ?? -1) + 1 },
    });
  }

  async renameModule(teacherId: string, moduleId: string, title: string) {
    const m = await this.prisma.module.findUnique({ where: { id: moduleId }, include: { course: true } });
    if (!m || m.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.module.update({ where: { id: moduleId }, data: { title } });
  }

  async deleteModule(teacherId: string, moduleId: string) {
    const m = await this.prisma.module.findUnique({ where: { id: moduleId }, include: { course: true } });
    if (!m || m.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.module.delete({ where: { id: moduleId } });
  }

  // ====== LESSONS ======
  async createLesson(teacherId: string, moduleId: string, title: string) {
    const m = await this.prisma.module.findUnique({ where: { id: moduleId }, include: { course: true } });
    if (!m || m.course.teacherId !== teacherId) throw new ForbiddenException();
    const last = await this.prisma.courseLesson.findFirst({ where: { moduleId }, orderBy: { position: 'desc' } });
    return this.prisma.courseLesson.create({
      data: { moduleId, title, position: (last?.position ?? -1) + 1 },
    });
  }

  async updateLesson(teacherId: string, lessonId: string, data: any) {
    const l = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!l || l.module.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        title: data.title ?? undefined,
        aiHelper: data.aiHelper ?? undefined,
        isHomework: data.isHomework ?? undefined,
        deadlineMode: data.deadlineMode ?? undefined,
        deadlineAt: data.deadlineAt ? new Date(data.deadlineAt) : undefined,
      },
    });
  }

  async deleteLesson(teacherId: string, lessonId: string) {
    const l = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!l || l.module.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.courseLesson.delete({ where: { id: lessonId } });
  }

  // ====== BLOCKS ======
  async addBlock(teacherId: string, lessonId: string, data: any) {
    const l = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!l || l.module.course.teacherId !== teacherId) throw new ForbiddenException();
    const last = await this.prisma.contentBlock.findFirst({
      where: { courseLessonId: lessonId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.contentBlock.create({
      data: {
        courseLessonId: lessonId,
        type: data.type,
        position: (last?.position ?? -1) + 1,
        isHomework: !!data.isHomework,
        videoUrls: data.videoUrls ?? [],
        textTitle: data.textTitle ?? null,
        textBody: data.textBody ?? null,
        miniQuizQuestion: data.miniQuizQuestion ?? null,
        miniQuizAnswer: data.miniQuizAnswer ?? null,
        fileUrls: data.fileUrls ?? [],
        quizKind: data.quizKind ?? null,
        quizPayload: data.quizPayload ?? null,
        quizCorrect: data.quizCorrect ?? null,
        writtenPrompt: data.writtenPrompt ?? null,
        writtenHint: data.writtenHint ?? null,
      },
    });
  }

  async updateBlock(teacherId: string, blockId: string, data: any) {
    const b = await this.prisma.contentBlock.findUnique({
      where: { id: blockId },
      include: { courseLesson: { include: { module: { include: { course: true } } } } },
    });
    if (!b || b.courseLesson.module.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.contentBlock.update({ where: { id: blockId }, data });
  }

  async deleteBlock(teacherId: string, blockId: string) {
    const b = await this.prisma.contentBlock.findUnique({
      where: { id: blockId },
      include: { courseLesson: { include: { module: { include: { course: true } } } } },
    });
    if (!b || b.courseLesson.module.course.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.contentBlock.delete({ where: { id: blockId } });
  }

  // ====== ACCESS ======
  async grantAccess(teacherId: string, courseId: string, body: { studentProfileIds?: string[]; groupId?: string; paid?: boolean; expiresAt?: string }) {
    await this.assertOwn(teacherId, courseId);
    const ids: string[] = [];
    if (body.studentProfileIds) ids.push(...body.studentProfileIds);
    if (body.groupId) {
      const members = await this.prisma.groupMember.findMany({ where: { groupId: body.groupId } });
      ids.push(...members.map((m) => m.studentId));
    }
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const created = [];
    for (const sid of [...new Set(ids)]) {
      const a = await this.prisma.courseAccess.upsert({
        where: { courseId_studentId: { courseId, studentId: sid } },
        update: { paid: !!body.paid, expiresAt },
        create: { courseId, studentId: sid, paid: !!body.paid, expiresAt },
      });
      created.push(a);
    }
    return created;
  }

  async revokeAccess(teacherId: string, courseId: string, studentProfileId: string) {
    await this.assertOwn(teacherId, courseId);
    return this.prisma.courseAccess.delete({
      where: { courseId_studentId: { courseId, studentId: studentProfileId } },
    });
  }

  // ====== STUDENT-FACING ======
  async listForStudent(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!sp) return [];
    return this.prisma.courseAccess.findMany({
      where: { studentId: sp.id },
      include: {
        course: {
          include: {
            teacher: { select: { fullName: true } },
            modules: {
              orderBy: { position: 'asc' },
              include: { lessons: { orderBy: { position: 'asc' }, include: { blocks: { orderBy: { position: 'asc' } } } } },
            },
          },
        },
      },
    });
  }

  async getCourseForStudent(userId: string, courseId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!sp) throw new ForbiddenException();
    const access = await this.prisma.courseAccess.findUnique({
      where: { courseId_studentId: { courseId, studentId: sp.id } },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: { lessons: { orderBy: { position: 'asc' }, include: { blocks: { orderBy: { position: 'asc' } } } } },
            },
          },
        },
      },
    });
    if (!access) throw new ForbiddenException();
    const expired = access.expiresAt && access.expiresAt < new Date();
    return { ...access, expired };
  }

  private async assertOwn(teacherId: string, courseId: string) {
    const c = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!c) throw new NotFoundException();
    if (c.teacherId !== teacherId) throw new ForbiddenException();
    return c;
  }
}
