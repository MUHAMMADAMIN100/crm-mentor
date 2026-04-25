import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listTeachers() {
    return this.prisma.user.findMany({
      where: { role: 'TEACHER' },
      include: { teacherSubscription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTeacher(data: { fullName: string; login: string; password: string; subscription?: any }) {
    const exists = await this.prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new NotFoundException('Логин уже занят');
    const hash = await AuthService.hashPassword(data.password);
    const user = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hash,
        role: 'TEACHER',
        fullName: data.fullName,
        teacherSubscription: {
          create: {
            status: data.subscription?.status || 'TRIAL',
            type: data.subscription?.type || null,
            startDate: data.subscription?.startDate ? new Date(data.subscription.startDate) : null,
            endDate: data.subscription?.endDate ? new Date(data.subscription.endDate) : null,
            amount: data.subscription?.amount ?? null,
          },
        },
      },
      include: { teacherSubscription: true },
    });
    return user;
  }

  async updateSubscription(teacherId: string, data: any) {
    return this.prisma.subscription.upsert({
      where: { teacherId },
      update: {
        status: data.status,
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount: data.amount ?? null,
      },
      create: {
        teacherId,
        status: data.status,
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount: data.amount ?? null,
      },
    });
  }

  archiveUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { archived: true } });
  }

  unarchiveUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { archived: false } });
  }

  deleteUser(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }

  listStudents() {
    return this.prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: { studentProfile: { include: { teacher: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listCourses() {
    return this.prisma.course.findMany({
      include: { teacher: true, _count: { select: { modules: true, accesses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async finance() {
    const subs = await this.prisma.subscription.findMany();
    const totalRevenue = subs.reduce((s, x) => s + (x.amount || 0), 0);
    return {
      totalRevenue,
      subscriptions: subs,
    };
  }

  async analytics() {
    const [teachers, students, courses, lessonsCompleted, homeworkDone] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.course.count(),
      this.prisma.lesson.count({ where: { status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'COMPLETED' } }),
    ]);
    return { teachers, students, courses, lessonsCompleted, homeworkDone };
  }
}
