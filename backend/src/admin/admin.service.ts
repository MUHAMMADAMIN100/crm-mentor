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
    // Include teacher info so the UI shows fullName/login instead of an opaque id.
    const subs = await this.prisma.subscription.findMany({
      include: { teacher: { select: { id: true, fullName: true, login: true, email: true, archived: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const totalRevenue = subs.reduce((s, x) => s + (x.amount || 0), 0);
    const activeRevenue = subs
      .filter((x) => x.status === 'ACTIVE')
      .reduce((s, x) => s + (x.amount || 0), 0);
    const counts = subs.reduce(
      (acc: any, x: any) => {
        acc[x.status] = (acc[x.status] || 0) + 1;
        return acc;
      },
      { TRIAL: 0, ACTIVE: 0, EXPIRED: 0, BLOCKED: 0 },
    );
    return {
      totalRevenue,
      activeRevenue,
      counts,
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

  /** Full operational dashboard: counts + items that need admin attention + recent activity. */
  async dashboard() {
    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 86400000);
    const in7d = new Date(now.getTime() + 7 * 86400000);
    const ago7d = new Date(now.getTime() - 7 * 86400000);
    const ago30d = new Date(now.getTime() - 30 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      teachersTotal, teachersActive, teachersTrial, teachersArchived,
      studentsTotal, studentsActive,
      coursesTotal,
      lessonsToday, lessonsCompletedTotal,
      newTeachers7d, newStudents7d, newTeachers30d, newStudents30d,
      subsExpiringSoon, subsExpired,
      teachersNoStudents, teachersNoCourses,
      paymentsThisMonth,
      recentTeachers, recentStudents, recentSubs,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false, teacherSubscription: { status: 'ACTIVE' } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false, teacherSubscription: { status: 'TRIAL' } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: true } }),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.course.count(),
      this.prisma.lesson.count({
        where: {
          startAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                     lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
        },
      }),
      this.prisma.lesson.count({ where: { status: 'COMPLETED' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', createdAt: { gte: ago7d } } }),
      this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: ago7d } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', createdAt: { gte: ago30d } } }),
      this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: ago30d } } }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in7d } },
        include: { teacher: { select: { id: true, fullName: true, login: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.subscription.findMany({
        where: { OR: [{ status: 'EXPIRED' }, { AND: [{ status: 'ACTIVE' }, { endDate: { lt: now } }] }] },
        include: { teacher: { select: { id: true, fullName: true, login: true } } },
        orderBy: { endDate: 'asc' },
        take: 20,
      }),
      // Teachers with no students
      this.prisma.user.findMany({
        where: { role: 'TEACHER', archived: false, teacherStudents: { none: {} } },
        select: { id: true, fullName: true, login: true, createdAt: true },
        take: 10,
      }),
      this.prisma.user.findMany({
        where: { role: 'TEACHER', archived: false, teacherCourses: { none: {} } },
        select: { id: true, fullName: true, login: true, createdAt: true },
        take: 10,
      }),
      this.prisma.subscription.aggregate({
        where: { startDate: { gte: monthStart }, status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'TEACHER' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, fullName: true, login: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'STUDENT' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, fullName: true, login: true, createdAt: true },
      }),
      this.prisma.subscription.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { teacher: { select: { id: true, fullName: true, login: true } } },
      }),
    ]);

    // Inactive teachers: no lessons in last 7 days
    const activeTeacherIdsRaw = await this.prisma.lesson.findMany({
      where: { startAt: { gte: ago7d } },
      distinct: ['teacherId'],
      select: { teacherId: true },
    });
    const activeIds = new Set(activeTeacherIdsRaw.map((x) => x.teacherId));
    const allActiveTeachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', archived: false },
      select: { id: true, fullName: true, login: true, createdAt: true },
    });
    const inactiveTeachers = allActiveTeachers.filter((t) => !activeIds.has(t.id)).slice(0, 10);

    return {
      counts: {
        teachersTotal, teachersActive, teachersTrial, teachersArchived,
        studentsTotal, studentsActive,
        coursesTotal,
        lessonsToday, lessonsCompletedTotal,
        newTeachers7d, newStudents7d, newTeachers30d, newStudents30d,
        revenueThisMonth: paymentsThisMonth._sum.amount || 0,
      },
      attention: {
        subsExpiringSoon,
        subsExpired,
        teachersNoStudents,
        teachersNoCourses,
        inactiveTeachers,
      },
      recent: {
        teachers: recentTeachers,
        students: recentStudents,
        subscriptions: recentSubs,
      },
    };
  }
}
