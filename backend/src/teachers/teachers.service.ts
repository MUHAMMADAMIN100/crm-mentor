import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  async dashboard(teacherId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayLessons, students, notifications, note] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { teacherId, startAt: { gte: today, lt: tomorrow } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.studentProfile.findMany({
        where: { teacherId, user: { archived: false } },
        include: { user: true, tree: true },
      }),
      this.prisma.notification.findMany({
        where: { userId: teacherId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.note.findUnique({ where: { userId: teacherId } }),
    ]);

    return { todayLessons, students, notifications, note };
  }

  setCurrency(teacherId: string, currency: string) {
    return this.prisma.user.update({ where: { id: teacherId }, data: { teacherCurrency: currency } });
  }
}
