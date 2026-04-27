import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RoleContext {
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  userId: string;
  fullName: string;
  data: any;
}

/**
 * Собирает урезанный по правам срез данных CRM, который ИИ может использовать в ответе.
 * Каждая роль получает только то, что ей видеть положено:
 *   ADMIN   — глобальная картина платформы (все учителя/ученики/курсы/выручка).
 *   TEACHER — только свои ученики, свои курсы, свои уроки/ДЗ/финансы.
 *   STUDENT — только свои курсы/прогресс/баланс/расписание.
 */
@Injectable()
export class AiContextService {
  constructor(private prisma: PrismaService) {}

  async build(userId: string): Promise<RoleContext> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.role === 'ADMIN') return { role: 'ADMIN', userId, fullName: user.fullName, data: await this.adminCtx() };
    if (user.role === 'TEACHER') return { role: 'TEACHER', userId, fullName: user.fullName, data: await this.teacherCtx(userId) };
    return { role: 'STUDENT', userId, fullName: user.fullName, data: await this.studentCtx(userId) };
  }

  private async adminCtx() {
    const [teachers, students, courses, subs, lessonsCompleted, hwDone, hwOverdue] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'TEACHER' },
        select: {
          id: true, fullName: true, login: true, email: true, archived: true, createdAt: true,
          teacherCurrency: true,
          _count: { select: { teacherStudents: true, teacherCourses: true, teacherLessons: true } },
          teacherSubscription: { select: { status: true, type: true, endDate: true, amount: true } },
        },
      }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.course.count(),
      this.prisma.subscription.findMany({ select: { status: true, amount: true, endDate: true, teacherId: true } }),
      this.prisma.lesson.count({ where: { status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'OVERDUE' } }),
    ]);
    const revenue = subs.reduce((s, x) => s + (x.amount || 0), 0);
    const expiringSoon = subs.filter((s) => s.endDate && s.endDate.getTime() - Date.now() < 7 * 86400000);
    return {
      summary: { teachers: teachers.length, students, courses, lessonsCompleted, homeworkDone: hwDone, homeworkOverdue: hwOverdue, totalRevenue: revenue },
      teachers,
      subscriptionsExpiringIn7d: expiringSoon,
    };
  }

  private async teacherCtx(teacherId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7);

    const [me, students, courses, lessonsToday, lessonsWeek, hwOverdue, hwInProgress, subscription] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: teacherId }, select: { fullName: true, teacherCurrency: true } }),
      this.prisma.studentProfile.findMany({
        where: { teacherId, user: { archived: false } },
        include: { user: { select: { fullName: true, email: true, login: true } }, tree: true },
      }),
      this.prisma.course.findMany({
        where: { teacherId },
        select: { id: true, title: true, status: true, _count: { select: { accesses: true, modules: true } } },
      }),
      this.prisma.lesson.findMany({
        where: { teacherId, startAt: { gte: today, lt: tomorrow } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.lesson.findMany({
        where: { teacherId, startAt: { gte: today, lte: weekAhead } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.homeworkSubmission.findMany({
        where: { courseLesson: { module: { course: { teacherId } } }, status: 'OVERDUE' },
        include: { student: { select: { fullName: true } }, courseLesson: { select: { title: true } } },
      }),
      this.prisma.homeworkSubmission.count({
        where: { courseLesson: { module: { course: { teacherId } } }, status: 'IN_PROGRESS' },
      }),
      this.prisma.subscription.findUnique({ where: { teacherId }, select: { status: true, endDate: true, type: true } }),
    ]);

    const negativeBalance = students.filter((s) => s.balance < 0);
    const totalDebt = negativeBalance.reduce((s, x) => s + Math.abs(x.balance), 0);
    const totalIncome = students.reduce((s, x) => s + (x.balance > 0 ? x.balance : 0), 0);

    return {
      teacher: me,
      summary: {
        totalStudents: students.length,
        totalCourses: courses.length,
        lessonsToday: lessonsToday.length,
        lessonsThisWeek: lessonsWeek.length,
        homeworkOverdue: hwOverdue.length,
        homeworkInProgress: hwInProgress,
        totalDebt,
        totalIncome,
        currency: me?.teacherCurrency || 'RUB',
      },
      students: students.map((s) => ({
        id: s.id,
        fullName: s.user.fullName,
        login: s.user.login,
        balance: s.balance,
        individualPrice: s.individualPrice,
        allowReschedule: s.allowReschedule,
        treeLevel: s.tree?.level ?? 0,
        treeCompleted: s.tree?.completedCount ?? 0,
        treeWithered: s.tree?.withered ?? false,
        treeRedFrame: s.tree?.redFrame ?? false,
      })),
      courses,
      lessonsToday,
      lessonsThisWeek,
      homeworkOverdue: hwOverdue.map((h) => ({
        student: h.student.fullName,
        lesson: h.courseLesson.title,
        wasOverdue: h.wasOverdue,
      })),
      mizSubscription: subscription,
    };
  }

  private async studentCtx(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { fullName: true, email: true } },
        teacher: { select: { fullName: true } },
        tree: true,
        courseAccesses: {
          include: {
            course: {
              include: {
                modules: {
                  include: { lessons: { include: { blocks: { select: { id: true, type: true, isHomework: true } } } } },
                },
              },
            },
          },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!sp) return { error: 'No profile' };

    const upcoming = await this.prisma.lesson.findMany({
      where: {
        OR: [
          { studentProfileId: sp.id },
          { group: { members: { some: { studentId: sp.id } } } },
        ],
        startAt: { gte: new Date() },
        status: 'PLANNED',
      },
      orderBy: { startAt: 'asc' },
      take: 10,
    });

    const homeworks = await this.prisma.homeworkSubmission.findMany({
      where: { studentId: userId },
      include: { courseLesson: { select: { title: true, deadlineAt: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      me: { fullName: sp.user.fullName, balance: sp.balance, allowReschedule: sp.allowReschedule, teacher: sp.teacher.fullName },
      tree: sp.tree,
      courses: sp.courseAccesses.map((a) => ({
        title: a.course.title,
        expiresAt: a.expiresAt,
        modulesCount: a.course.modules.length,
        lessonsCount: a.course.modules.reduce((n, m) => n + m.lessons.length, 0),
      })),
      upcomingLessons: upcoming,
      homeworks: homeworks.map((h) => ({
        lesson: h.courseLesson.title,
        deadline: h.courseLesson.deadlineAt,
        status: h.status,
        wasOverdue: h.wasOverdue,
      })),
      recentPayments: sp.payments,
    };
  }
}
