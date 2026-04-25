import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // --- TEACHER ---
  async teacherCalendar(teacherId: string, from?: string, to?: string) {
    const fromD = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toD = to ? new Date(to) : new Date(Date.now() + 60 * 86400000);
    const [lessons, freeSlots, events] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { teacherId, startAt: { gte: fromD, lte: toD } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.freeSlot.findMany({
        where: { teacherId, startAt: { gte: fromD, lte: toD } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.personalEvent.findMany({
        where: { userId: teacherId, startAt: { gte: fromD, lte: toD } },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    return { lessons, freeSlots, events };
  }

  createLesson(teacherId: string, body: any) {
    return this.prisma.lesson.create({
      data: {
        teacherId,
        type: body.type,
        studentProfileId: body.studentProfileId || null,
        groupId: body.groupId || null,
        startAt: new Date(body.startAt),
        durationMin: body.durationMin ?? 60,
        link: body.link || null,
        comment: body.comment || null,
      },
    });
  }

  async updateLesson(teacherId: string, lessonId: string, body: any) {
    const l = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!l || l.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        durationMin: body.durationMin ?? undefined,
        link: body.link ?? undefined,
        comment: body.comment ?? undefined,
        status: body.status ?? undefined,
      },
    });
  }

  async deleteLesson(teacherId: string, lessonId: string) {
    const l = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!l || l.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  // Mark lesson as completed -> charge balance
  async completeLesson(teacherId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { group: { include: { members: true } } },
    });
    if (!lesson || lesson.teacherId !== teacherId) throw new ForbiddenException();
    if (lesson.status === 'COMPLETED' || lesson.charged) {
      return this.prisma.lesson.update({ where: { id: lessonId }, data: { status: 'COMPLETED' } });
    }

    if (lesson.type === 'INDIVIDUAL' && lesson.studentProfileId) {
      const sp = await this.prisma.studentProfile.findUnique({ where: { id: lesson.studentProfileId } });
      if (!sp) throw new NotFoundException();
      const price = sp.individualPrice ?? 0;
      await this.prisma.studentProfile.update({
        where: { id: sp.id },
        data: { balance: { decrement: price } },
      });
      await this.prisma.payment.create({
        data: { studentId: sp.id, kind: 'CHARGE', amount: price, lessonId },
      });
      await this.notifyBalanceIfNeeded(sp.id, lesson.teacherId);
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { status: 'COMPLETED', charged: true, priceCharged: price },
      });
    } else if (lesson.type === 'GROUP' && lesson.group) {
      for (const m of lesson.group.members) {
        await this.prisma.studentProfile.update({
          where: { id: m.studentId },
          data: { balance: { decrement: m.pricePerLesson } },
        });
        await this.prisma.payment.create({
          data: { studentId: m.studentId, kind: 'CHARGE', amount: m.pricePerLesson, lessonId },
        });
        await this.notifyBalanceIfNeeded(m.studentId, teacherId);
      }
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { status: 'COMPLETED', charged: true },
      });
    }

    return this.prisma.lesson.findUnique({ where: { id: lessonId } });
  }

  private async notifyBalanceIfNeeded(studentProfileId: string, teacherId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { user: true },
    });
    if (!sp) return;
    if (sp.balance <= 0) {
      await this.prisma.notification.create({
        data: {
          userId: sp.userId,
          kind: 'BALANCE',
          title: 'Закончился баланс',
          body: 'У вас закончился баланс. Пожалуйста, пополните оплату до следующего занятия.',
        },
      });
      await this.prisma.notification.create({
        data: {
          userId: teacherId,
          kind: 'BALANCE',
          title: `У ученика ${sp.user.fullName} закончился баланс`,
        },
      });
    }
  }

  // FREE SLOTS
  createFreeSlot(teacherId: string, body: { startAt: string; durationMin?: number }) {
    return this.prisma.freeSlot.create({
      data: { teacherId, startAt: new Date(body.startAt), durationMin: body.durationMin ?? 60 },
    });
  }

  async deleteFreeSlot(teacherId: string, id: string) {
    const s = await this.prisma.freeSlot.findUnique({ where: { id } });
    if (!s || s.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.freeSlot.delete({ where: { id } });
  }

  // PERSONAL EVENT
  createEvent(userId: string, body: { title: string; startAt: string; reminder?: boolean; description?: string }) {
    return this.prisma.personalEvent.create({
      data: {
        userId,
        title: body.title,
        startAt: new Date(body.startAt),
        reminder: !!body.reminder,
        description: body.description || null,
      },
    });
  }

  async deleteEvent(userId: string, id: string) {
    const e = await this.prisma.personalEvent.findUnique({ where: { id } });
    if (!e || e.userId !== userId) throw new ForbiddenException();
    return this.prisma.personalEvent.delete({ where: { id } });
  }

  // STUDENT
  async studentCalendar(userId: string, from?: string, to?: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!sp) return { lessons: [], events: [] };
    const fromD = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toD = to ? new Date(to) : new Date(Date.now() + 60 * 86400000);
    const [lessons, events] = await Promise.all([
      this.prisma.lesson.findMany({
        where: {
          OR: [
            { studentProfileId: sp.id },
            { group: { members: { some: { studentId: sp.id } } } },
          ],
          startAt: { gte: fromD, lte: toD },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.personalEvent.findMany({
        where: { userId, startAt: { gte: fromD, lte: toD } },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    return { lessons, events };
  }

  async rescheduleByStudent(userId: string, lessonId: string, newSlotId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!sp) throw new ForbiddenException();
    if (!sp.allowReschedule) throw new ForbiddenException('Перенос не разрешён');
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.studentProfileId !== sp.id || lesson.type !== 'INDIVIDUAL') {
      throw new BadRequestException('Урок нельзя перенести');
    }
    const slot = await this.prisma.freeSlot.findUnique({ where: { id: newSlotId } });
    if (!slot || slot.teacherId !== lesson.teacherId) throw new BadRequestException();

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.lesson.update({
        where: { id: lessonId },
        data: { startAt: slot.startAt, durationMin: slot.durationMin, status: 'PLANNED' },
      });
      await tx.freeSlot.delete({ where: { id: newSlotId } });
      return upd;
    });

    await this.prisma.notification.create({
      data: {
        userId: lesson.teacherId,
        kind: 'RESCHEDULE',
        title: 'Перенос урока',
        body: `Ученик перенёс урок на ${slot.startAt.toLocaleString('ru-RU')}`,
      },
    });
    return updated;
  }
}
