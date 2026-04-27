import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RoleContext {
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  userId: string;
  fullName: string;
  data: any;
}

@Injectable()
export class AiContextService {
  constructor(private prisma: PrismaService) {}

  async build(userId: string): Promise<RoleContext> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    let data: any = {};
    try {
      if (user.role === 'ADMIN') data = await this.adminCtx();
      else if (user.role === 'TEACHER') data = await this.teacherCtx(userId);
      else data = await this.studentCtx(userId);
    } catch (e: any) {
      data = { error: e?.message || String(e) };
    }
    return { role: user.role as any, userId, fullName: user.fullName, data };
  }

  private async adminCtx() {
    const [teachersCount, studentsCount, coursesCount, subs, lessonsCompleted, hwDone, hwOverdue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.course.count(),
      this.prisma.subscription.findMany(),
      this.prisma.lesson.count({ where: { status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'OVERDUE' } }),
    ]);
    const teachers = await this.prisma.user.findMany({ where: { role: 'TEACHER' } });
    const revenue = subs.reduce((s: number, x: any) => s + (x.amount || 0), 0);
    const expiringSoon = subs.filter(
      (s: any) => s.endDate && new Date(s.endDate).getTime() - Date.now() < 7 * 86400000,
    );
    return {
      summary: {
        teachers: teachersCount,
        students: studentsCount,
        courses: coursesCount,
        lessonsCompleted,
        homeworkDone: hwDone,
        homeworkOverdue: hwOverdue,
        totalRevenue: revenue,
      },
      teachers: teachers.map((t: any) => ({
        id: t.id,
        fullName: t.fullName,
        login: t.login,
        email: t.email,
        archived: t.archived,
        currency: t.teacherCurrency,
      })),
      subscriptionsExpiringIn7d: expiringSoon,
    };
  }

  private async teacherCtx(teacherId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7);

    const me = await this.prisma.user.findUnique({ where: { id: teacherId } });
    const studentProfiles = await this.prisma.studentProfile.findMany({ where: { teacherId } });
    const studentUsers = await this.prisma.user.findMany({
      where: { id: { in: studentProfiles.map((s: any) => s.userId) } },
    });
    const trees = await this.prisma.motivationTree.findMany({
      where: { studentId: { in: studentProfiles.map((s: any) => s.id) } },
    });
    const courses = await this.prisma.course.findMany({ where: { teacherId } });
    const lessonsToday = await this.prisma.lesson.findMany({
      where: { teacherId, startAt: { gte: today, lt: tomorrow } },
      orderBy: { startAt: 'asc' },
    });
    const lessonsWeek = await this.prisma.lesson.findMany({
      where: { teacherId, startAt: { gte: today, lte: weekAhead } },
      orderBy: { startAt: 'asc' },
    });
    const hwOverdueRaw = await this.prisma.homeworkSubmission.findMany({
      where: { courseLesson: { module: { course: { teacherId } } }, status: 'OVERDUE' },
    });
    const subscription = await this.prisma.subscription.findUnique({ where: { teacherId } });

    const negativeBalance = studentProfiles.filter((s: any) => s.balance < 0);
    const totalDebt = negativeBalance.reduce((s: number, x: any) => s + Math.abs(x.balance), 0);
    const totalIncome = studentProfiles.reduce(
      (s: number, x: any) => s + (x.balance > 0 ? x.balance : 0),
      0,
    );
    const currency = me?.teacherCurrency || 'RUB';

    const studentsBlock = studentProfiles.map((sp: any) => {
      const u = studentUsers.find((x: any) => x.id === sp.userId);
      const t = trees.find((x: any) => x.studentId === sp.id);
      return {
        id: sp.id,
        fullName: u?.fullName,
        login: u?.login,
        balance: sp.balance,
        individualPrice: sp.individualPrice,
        allowReschedule: sp.allowReschedule,
        treeLevel: t?.level ?? 0,
        treeCompleted: t?.completedCount ?? 0,
        treeWithered: t?.withered ?? false,
      };
    });

    return {
      teacher: { fullName: me?.fullName, currency },
      summary: {
        totalStudents: studentProfiles.length,
        totalCourses: courses.length,
        lessonsToday: lessonsToday.length,
        lessonsThisWeek: lessonsWeek.length,
        homeworkOverdue: hwOverdueRaw.length,
        totalDebt,
        totalIncome,
        currency,
      },
      students: studentsBlock,
      courses: courses.map((c: any) => ({ id: c.id, title: c.title, status: c.status })),
      lessonsToday,
      lessonsThisWeek,
      mizSubscription: subscription,
    };
  }

  private async studentCtx(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!sp) return { error: 'No student profile' };
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    const teacher = await this.prisma.user.findUnique({ where: { id: sp.teacherId } });
    const tree = await this.prisma.motivationTree.findUnique({ where: { studentId: sp.id } });
    const accesses = await this.prisma.courseAccess.findMany({ where: { studentId: sp.id } });
    const courses = await this.prisma.course.findMany({
      where: { id: { in: accesses.map((a: any) => a.courseId) } },
    });
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
    const homeworks = await this.prisma.homeworkSubmission.findMany({ where: { studentId: userId } });
    const payments = await this.prisma.payment.findMany({
      where: { studentId: sp.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      me: {
        fullName: me?.fullName,
        balance: sp.balance,
        allowReschedule: sp.allowReschedule,
        teacher: teacher?.fullName,
      },
      tree,
      courses: courses.map((c: any) => ({
        id: c.id,
        title: c.title,
        access: accesses.find((a: any) => a.courseId === c.id),
      })),
      upcomingLessons: upcoming,
      homeworks,
      recentPayments: payments,
    };
  }
}
