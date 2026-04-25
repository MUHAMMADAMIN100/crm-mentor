import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async listForTeacher(teacherId: string) {
    return this.prisma.studentProfile.findMany({
      where: { teacherId, user: { archived: false } },
      include: { user: true, tree: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStudent(
    teacherId: string,
    data: { fullName: string; login: string; password: string; individualPrice?: number },
  ) {
    const exists = await this.prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new BadRequestException('Логин уже занят');
    const hash = await AuthService.hashPassword(data.password);
    const created = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hash,
        role: 'STUDENT',
        fullName: data.fullName,
        studentProfile: {
          create: {
            teacherId,
            individualPrice: data.individualPrice ?? null,
            tree: { create: {} },
          },
        },
      },
      include: { studentProfile: { include: { tree: true } } },
    });
    return created;
  }

  async getById(teacherId: string, studentProfileId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        user: true,
        tree: true,
        groups: { include: { group: true } },
        courseAccesses: { include: { course: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sp) throw new NotFoundException();
    if (sp.teacherId !== teacherId) throw new ForbiddenException();
    return sp;
  }

  async updateSettings(teacherId: string, profileId: string, data: { allowReschedule?: boolean; individualPrice?: number }) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!sp || sp.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.studentProfile.update({
      where: { id: profileId },
      data: {
        allowReschedule: data.allowReschedule ?? undefined,
        individualPrice: data.individualPrice ?? undefined,
      },
    });
  }

  async archive(teacherId: string, profileId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!sp || sp.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.user.update({ where: { id: sp.userId }, data: { archived: true } });
  }

  async studentDashboard(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        tree: true,
        courseAccesses: {
          include: {
            course: { include: { modules: { include: { lessons: true } } } },
          },
        },
      },
    });
    if (!sp) throw new NotFoundException();

    const upcomingLessons = await this.prisma.lesson.findMany({
      where: {
        OR: [
          { studentProfileId: sp.id },
          { group: { members: { some: { studentId: sp.id } } } },
        ],
        startAt: { gte: new Date() },
        status: 'PLANNED',
      },
      orderBy: { startAt: 'asc' },
      take: 5,
    });

    const homeworks = await this.prisma.homeworkSubmission.findMany({
      where: { studentId: userId, status: { in: ['IN_PROGRESS', 'OVERDUE'] } },
      include: { courseLesson: true },
      orderBy: { updatedAt: 'desc' },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return { profile: sp, upcomingLessons, homeworks, notifications };
  }
}
