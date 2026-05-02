import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from './audit.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ============================================================
  // Teachers
  // ============================================================
  async listTeachers(opts: { search?: string; status?: string; archived?: string; sort?: string; activity?: string; hasStudents?: string; hasCourses?: string; limit?: string; offset?: string } = {}) {
    const where: any = { role: 'TEACHER' };
    if (opts.archived === 'archived') where.archived = true;
    else if (opts.archived === 'active') where.archived = false;

    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { telegram: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (opts.status && ['TRIAL', 'ACTIVE', 'EXPIRED', 'BLOCKED', 'PAUSED', 'CANCELED'].includes(opts.status)) {
      where.teacherSubscription = { status: opts.status };
    }
    if (opts.hasStudents === 'yes') where.teacherStudents = { some: {} };
    else if (opts.hasStudents === 'no') where.teacherStudents = { none: {} };
    if (opts.hasCourses === 'yes') where.teacherCourses = { some: {} };
    else if (opts.hasCourses === 'no') where.teacherCourses = { none: {} };
    // Activity filter — measured by lastLoginAt window
    if (opts.activity === '7d') {
      const cutoff = new Date(Date.now() - 7 * 86400000);
      where.lastLoginAt = { gte: cutoff };
    } else if (opts.activity === '30d') {
      const cutoff = new Date(Date.now() - 30 * 86400000);
      where.lastLoginAt = { gte: cutoff };
    } else if (opts.activity === 'inactive7d') {
      const cutoff = new Date(Date.now() - 7 * 86400000);
      where.OR = [...(where.OR || []), { lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }];
    }

    // Sort: `name`, `-name`, `created`, `-created`, `students`, `-students`, `courses`, `-courses`, `activity`, `-activity`
    let orderBy: any = { createdAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'name') orderBy = { fullName: desc ? 'desc' : 'asc' };
    else if (field === 'created') orderBy = { createdAt: desc ? 'desc' : 'asc' };
    else if (field === 'activity') orderBy = { lastLoginAt: desc ? 'desc' : 'asc' };
    else if (field === 'students') orderBy = { teacherStudents: { _count: desc ? 'desc' : 'asc' } };
    else if (field === 'courses') orderBy = { teacherCourses: { _count: desc ? 'desc' : 'asc' } };

    const take = opts.limit ? Math.min(500, Math.max(1, +opts.limit)) : undefined;
    const skip = opts.offset ? Math.max(0, +opts.offset) : undefined;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          teacherSubscription: true,
          _count: { select: { teacherStudents: true, teacherCourses: true, teacherLessons: true } },
        },
        orderBy,
        take, skip,
      }),
      take !== undefined ? this.prisma.user.count({ where }) : Promise.resolve(undefined),
    ]);
    if (take !== undefined) return { items, total };
    return items;
  }

  async createTeacher(actorId: string, data: { fullName: string; login: string; password: string; email?: string; phone?: string; subscription?: any }) {
    const exists = await this.prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new BadRequestException('Логин уже занят');
    const hash = await AuthService.hashPassword(data.password);
    const user = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hash,
        plainPassword: data.password,
        role: 'TEACHER',
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        mustChangePassword: false,
        teacherSubscription: {
          create: {
            status: data.subscription?.status || 'TRIAL',
            type: data.subscription?.type || null,
            startDate: data.subscription?.startDate ? new Date(data.subscription.startDate) : null,
            endDate: data.subscription?.endDate ? new Date(data.subscription.endDate) : null,
            amount: data.subscription?.amount ?? null,
            currency: data.subscription?.currency ?? null,
          },
        },
      },
      include: { teacherSubscription: true },
    });
    this.audit.log(actorId, 'teacher.create', { targetType: 'User', targetId: user.id, meta: { fullName: data.fullName } });
    return user;
  }

  /** Full teacher card — everything an admin needs to see in one go. */
  async getTeacherCard(teacherId: string) {
    const t = await this.prisma.user.findUnique({
      where: { id: teacherId },
      include: {
        teacherSubscription: { include: { history: { orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { id: true, fullName: true, login: true } } } } } },
        teacherStudents: {
          include: { user: { select: { id: true, fullName: true, login: true, archived: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        teacherCourses: {
          select: { id: true, title: true, status: true, createdAt: true, _count: { select: { modules: true, accesses: true } } },
          orderBy: { createdAt: 'desc' },
        },
        teacherGroups: { select: { id: true, name: true, _count: { select: { members: true } } } },
        _count: { select: { teacherStudents: true, teacherCourses: true, teacherLessons: true, teacherGroups: true } },
      },
    });
    if (!t || t.role !== 'TEACHER') throw new NotFoundException();
    const lessonsCompleted = await this.prisma.lesson.count({ where: { teacherId, status: 'COMPLETED' } });
    const lessonsPlanned = await this.prisma.lesson.count({ where: { teacherId, status: 'PLANNED' } });
    const recentLessons = await this.prisma.lesson.findMany({
      where: { teacherId },
      orderBy: { startAt: 'desc' },
      take: 10,
      select: { id: true, startAt: true, status: true, type: true, durationMin: true },
    });
    const audit = await this.prisma.auditLog.findMany({
      where: { OR: [{ targetId: teacherId }, { actorId: teacherId }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { actor: { select: { id: true, fullName: true, login: true } } },
    });
    return { teacher: t, stats: { lessonsCompleted, lessonsPlanned }, recentLessons, audit };
  }

  /** Edit basic teacher profile fields. */
  async updateTeacher(actorId: string, teacherId: string, data: any) {
    const t = await this.prisma.user.findUnique({ where: { id: teacherId } });
    if (!t || t.role !== 'TEACHER') throw new NotFoundException();
    if (data.login && data.login !== t.login) {
      const taken = await this.prisma.user.findFirst({ where: { login: data.login, NOT: { id: teacherId } }, select: { id: true } });
      if (taken) throw new BadRequestException('Логин уже занят');
    }
    const updated = await this.prisma.user.update({
      where: { id: teacherId },
      data: {
        fullName: data.fullName ?? undefined,
        login: data.login ?? undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        telegram: data.telegram ?? undefined,
        whatsapp: data.whatsapp ?? undefined,
        instagram: data.instagram ?? undefined,
        website: data.website ?? undefined,
        city: data.city ?? undefined,
        category: data.category ?? undefined,
        ...(data.password
          ? { password: await AuthService.hashPassword(data.password), plainPassword: data.password, mustChangePassword: false }
          : {}),
      },
    });
    this.audit.log(actorId, 'teacher.edit', { targetType: 'User', targetId: teacherId, meta: { fields: Object.keys(data) } });
    const { password, ...rest } = updated as any;
    return rest;
  }

  // ============================================================
  // Subscriptions
  // ============================================================
  async updateSubscription(actorId: string, teacherId: string, data: any) {
    const t = await this.prisma.user.findUnique({ where: { id: teacherId }, include: { teacherSubscription: true } });
    if (!t || t.role !== 'TEACHER') throw new NotFoundException();
    const prev = t.teacherSubscription;

    const next = await this.prisma.subscription.upsert({
      where: { teacherId },
      update: {
        status: data.status,
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount: data.amount ?? null,
        currency: data.currency ?? undefined,
        source: data.source ?? undefined,
        comment: data.comment ?? undefined,
      },
      create: {
        teacherId,
        status: data.status,
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount: data.amount ?? null,
        currency: data.currency ?? null,
        source: data.source ?? 'manual_admin',
        comment: data.comment ?? null,
      },
    });

    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: next.id,
        actorId,
        action: prev ? 'edit' : 'create',
        prevStatus: prev?.status ?? undefined,
        nextStatus: next.status,
        prevEndDate: prev?.endDate ?? undefined,
        nextEndDate: next.endDate ?? undefined,
        amount: next.amount ?? undefined,
        comment: data.comment,
      },
    });
    this.audit.log(actorId, 'subscription.update', {
      targetType: 'Subscription',
      targetId: next.id,
      meta: { teacherId, status: next.status },
    });
    return next;
  }

  /** Extend a subscription by N months. Bumps endDate, sets ACTIVE if it was EXPIRED. */
  async extendSubscription(actorId: string, teacherId: string, months: number, amount?: number, comment?: string) {
    if (![1, 3, 6, 12].includes(months)) throw new BadRequestException('Допустимо 1, 3, 6 или 12 месяцев');
    const sub = await this.prisma.subscription.findUnique({ where: { teacherId } });
    if (!sub) throw new NotFoundException('Подписка не найдена');
    const baseDate = sub.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
    const nextEnd = new Date(baseDate);
    nextEnd.setMonth(nextEnd.getMonth() + months);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        endDate: nextEnd,
        status: 'ACTIVE',
        amount: amount ?? sub.amount,
        type: months === 12 ? 'YEAR' : 'MONTH',
      },
    });
    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        actorId,
        action: 'extend',
        prevStatus: sub.status,
        nextStatus: 'ACTIVE',
        prevEndDate: sub.endDate ?? undefined,
        nextEndDate: nextEnd,
        amount: amount ?? sub.amount ?? undefined,
        comment: comment ?? `Продление на ${months} мес.`,
      },
    });
    this.audit.log(actorId, 'subscription.extend', {
      targetType: 'Subscription',
      targetId: sub.id,
      meta: { teacherId, months, amount },
    });
    return updated;
  }

  /** Pause / cancel / unblock helpers. */
  async setSubscriptionStatus(actorId: string, teacherId: string, status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'PAUSED' | 'CANCELED' | 'TRIAL', comment?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { teacherId } });
    if (!sub) throw new NotFoundException();
    const updated = await this.prisma.subscription.update({ where: { id: sub.id }, data: { status, comment: comment ?? sub.comment } });
    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        actorId,
        action: 'status_change',
        prevStatus: sub.status,
        nextStatus: status,
        comment,
      },
    });
    this.audit.log(actorId, 'subscription.status', { targetType: 'Subscription', targetId: sub.id, meta: { teacherId, status } });
    return updated;
  }

  // ============================================================
  // Users — archive / unarchive / delete (with audit + reason)
  // ============================================================
  async archiveUser(actorId: string, userId: string, reason?: string) {
    if (actorId === userId) throw new BadRequestException('Нельзя архивировать самого себя');
    const u = await this.prisma.user.update({ where: { id: userId }, data: { archived: true, archiveReason: reason ?? null } });
    this.audit.log(actorId, `${u.role.toLowerCase()}.archive`, { targetType: 'User', targetId: userId, meta: { reason } });
    return u;
  }

  async unarchiveUser(actorId: string, userId: string) {
    const u = await this.prisma.user.update({ where: { id: userId }, data: { archived: false, archiveReason: null } });
    this.audit.log(actorId, `${u.role.toLowerCase()}.unarchive`, { targetType: 'User', targetId: userId });
    return u;
  }

  async deleteUser(actorId: string, userId: string, reason?: string) {
    if (actorId === userId) throw new BadRequestException('Нельзя удалить самого себя');
    const me = await this.prisma.user.findUnique({ where: { id: actorId }, select: { adminLevel: true } });
    if (me?.adminLevel && me.adminLevel !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только super admin может удалять аккаунты');
    }
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, fullName: true, login: true } });
    if (!u) throw new NotFoundException();
    await this.prisma.user.delete({ where: { id: userId } });
    this.audit.log(actorId, `${u.role.toLowerCase()}.delete`, { targetType: 'User', targetId: userId, meta: { reason, fullName: u.fullName, login: u.login } });
    return { ok: true };
  }

  /** Bulk archive — used by mass actions in the teachers/students table. */
  async bulkArchive(actorId: string, ids: string[], reason?: string) {
    const filtered = ids.filter((id) => id !== actorId);
    await this.prisma.user.updateMany({ where: { id: { in: filtered } }, data: { archived: true, archiveReason: reason ?? null } });
    this.audit.log(actorId, 'bulk.archive', { meta: { ids: filtered, reason } });
    return { count: filtered.length };
  }

  // ============================================================
  // Students
  // ============================================================
  async listStudents(opts: { search?: string; archived?: string; teacherId?: string; tag?: string; sort?: string; activity?: string; limit?: string; offset?: string } = {}) {
    const where: any = { role: 'STUDENT' };
    if (opts.archived === 'archived') where.archived = true;
    else if (opts.archived === 'active') where.archived = false;
    if (opts.tag) where.tags = { contains: opts.tag };
    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (opts.teacherId) {
      where.studentProfile = { teacherId: opts.teacherId };
    }
    if (opts.activity === '7d') {
      where.lastLoginAt = { gte: new Date(Date.now() - 7 * 86400000) };
    } else if (opts.activity === '30d') {
      where.lastLoginAt = { gte: new Date(Date.now() - 30 * 86400000) };
    } else if (opts.activity === 'inactive7d') {
      where.OR = [...(where.OR || []), { lastLoginAt: null }, { lastLoginAt: { lt: new Date(Date.now() - 7 * 86400000) } }];
    }

    let orderBy: any = { createdAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'name') orderBy = { fullName: desc ? 'desc' : 'asc' };
    else if (field === 'created') orderBy = { createdAt: desc ? 'desc' : 'asc' };
    else if (field === 'activity') orderBy = { lastLoginAt: desc ? 'desc' : 'asc' };

    const take = opts.limit ? Math.min(500, Math.max(1, +opts.limit)) : undefined;
    const skip = opts.offset ? Math.max(0, +opts.offset) : undefined;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { studentProfile: { include: { teacher: { select: { id: true, fullName: true, login: true } } } } },
        orderBy,
        take, skip,
      }),
      take !== undefined ? this.prisma.user.count({ where }) : Promise.resolve(undefined),
    ]);
    if (take !== undefined) return { items, total };
    return items;
  }

  async getStudentCard(studentUserId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: studentUserId },
      include: {
        studentProfile: {
          include: {
            teacher: { select: { id: true, fullName: true, login: true } },
            payments: { orderBy: { createdAt: 'desc' }, take: 50 },
            courseAccesses: { include: { course: { select: { id: true, title: true } } } },
            groups: { include: { group: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!u || u.role !== 'STUDENT') throw new NotFoundException();
    const lessonsCount = u.studentProfile
      ? await this.prisma.lesson.count({ where: { studentProfileId: u.studentProfile.id } })
      : 0;
    const completedHomework = await this.prisma.homeworkSubmission.count({
      where: { studentId: studentUserId, status: 'COMPLETED' },
    });
    const audit = await this.prisma.auditLog.findMany({
      where: { OR: [{ targetId: studentUserId }, { actorId: studentUserId }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { id: true, fullName: true, login: true } } },
    });
    return { user: u, stats: { lessonsCount, completedHomework }, audit };
  }

  /** Move a student to another teacher. */
  async transferStudent(actorId: string, studentProfileId: string, newTeacherId: string) {
    const t = await this.prisma.user.findUnique({ where: { id: newTeacherId }, select: { id: true, role: true } });
    if (!t || t.role !== 'TEACHER') throw new BadRequestException('Целевой учитель не найден');
    const sp = await this.prisma.studentProfile.update({ where: { id: studentProfileId }, data: { teacherId: newTeacherId } });
    this.audit.log(actorId, 'student.transfer', { targetType: 'StudentProfile', targetId: studentProfileId, meta: { newTeacherId } });
    return sp;
  }

  async setStudentTags(actorId: string, studentUserId: string, tags: string) {
    const u = await this.prisma.user.update({ where: { id: studentUserId }, data: { tags } });
    this.audit.log(actorId, 'student.tags', { targetType: 'User', targetId: studentUserId, meta: { tags } });
    return u;
  }

  // ============================================================
  // Courses
  // ============================================================
  async listCourses(opts: { search?: string; status?: string; teacherId?: string } = {}) {
    const where: any = {};
    if (opts.status && ['DRAFT', 'PUBLISHED_PRIVATE', 'ARCHIVED'].includes(opts.status)) where.status = opts.status;
    if (opts.teacherId) where.teacherId = opts.teacherId;
    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.course.findMany({
      where,
      include: { teacher: { select: { id: true, fullName: true, login: true } }, _count: { select: { modules: true, accesses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCourseCard(courseId: string) {
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: { select: { id: true, fullName: true, login: true } },
        modules: { include: { lessons: { include: { blocks: true } } }, orderBy: { position: 'asc' } },
        accesses: { include: { student: { include: { user: { select: { id: true, fullName: true, login: true } } } } } },
      },
    });
    if (!c) throw new NotFoundException();
    return c;
  }

  async setCourseStatus(actorId: string, courseId: string, status: 'DRAFT' | 'PUBLISHED_PRIVATE' | 'ARCHIVED') {
    const c = await this.prisma.course.update({ where: { id: courseId }, data: { status } });
    this.audit.log(actorId, 'course.status', { targetType: 'Course', targetId: courseId, meta: { status } });
    return c;
  }

  // ============================================================
  // Finance
  // ============================================================
  async finance(opts: { search?: string; status?: string; period?: string } = {}) {
    const where: any = {};
    if (opts.status && opts.status !== 'all') where.status = opts.status;
    const search = opts.search?.trim();
    if (search) {
      where.teacher = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { login: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    const subs = await this.prisma.subscription.findMany({
      where,
      include: { teacher: { select: { id: true, fullName: true, login: true, email: true, archived: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    // KPIs
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodMs = opts.period === '7d' ? 7 * 86400000 : opts.period === '90d' ? 90 * 86400000 : 30 * 86400000;
    const cutoff = new Date(now.getTime() - periodMs);

    const totalRevenue = subs.reduce((s, x) => s + (x.amount || 0), 0);
    const activeSubs = subs.filter((x) => x.status === 'ACTIVE');
    const activeRevenue = activeSubs.reduce((s, x) => s + (x.amount || 0), 0);
    const counts = { TRIAL: 0, ACTIVE: 0, EXPIRED: 0, BLOCKED: 0, PAUSED: 0, CANCELED: 0 };
    subs.forEach((x: any) => { counts[x.status as keyof typeof counts] = (counts[x.status as keyof typeof counts] || 0) + 1; });

    // MRR — sum of monthly-equivalent revenue from active monthly + active yearly/12
    const mrr = activeSubs.reduce((s, x) => s + ((x.amount || 0) / (x.type === 'YEAR' ? 12 : 1)), 0);
    const arpu = activeSubs.length ? mrr / activeSubs.length : 0;

    // Period revenue (subs whose start/update falls in the period)
    const periodRevenue = subs
      .filter((x) => x.startDate && x.startDate >= cutoff)
      .reduce((s, x) => s + (x.amount || 0), 0);

    // Churn — % of subs that became EXPIRED/CANCELED in the period
    const churned = subs.filter((x) => (x.status === 'EXPIRED' || x.status === 'CANCELED') && x.updatedAt >= cutoff).length;
    const churnRate = activeSubs.length + churned > 0 ? churned / (activeSubs.length + churned) : 0;

    return {
      totalRevenue,
      activeRevenue,
      periodRevenue,
      mrr,
      arpu,
      churnRate,
      counts,
      subscriptions: subs,
    };
  }

  // ============================================================
  // Analytics
  // ============================================================
  async analytics(opts: { period?: string } = {}) {
    const now = new Date();
    const periodDays = opts.period === '7d' ? 7 : opts.period === '90d' ? 90 : opts.period === 'all' ? 3650 : 30;
    const cutoff = new Date(now.getTime() - periodDays * 86400000);

    const [
      teachersTotal, teachersActive, teachersArchived,
      studentsTotal, studentsActive, studentsArchived,
      coursesTotal,
      lessonsCompleted, lessonsTotal,
      homeworkDone, homeworkTotal,
      subsActive, subsTrial, subsExpired,
      teacherRegistrationsByDay,
      revenueByDay,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: true } }),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: true } }),
      this.prisma.course.count(),
      this.prisma.lesson.count({ where: { status: 'COMPLETED', startAt: { gte: cutoff } } }),
      this.prisma.lesson.count({ where: { startAt: { gte: cutoff } } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'COMPLETED', updatedAt: { gte: cutoff } } }),
      this.prisma.homeworkSubmission.count({ where: { updatedAt: { gte: cutoff } } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      this.prisma.user.findMany({
        where: { role: 'TEACHER', createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }),
      this.prisma.subscription.findMany({
        where: { startDate: { gte: cutoff } },
        select: { startDate: true, amount: true },
      }),
    ]);

    // Group by day
    const teacherSeries = bucketByDay(teacherRegistrationsByDay.map((x) => ({ date: x.createdAt, value: 1 })));
    const revenueSeries = bucketByDay(revenueByDay.map((x) => ({ date: x.startDate as Date, value: x.amount || 0 })));

    // Operational metrics from audit log
    const auditStats = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: cutoff } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 20,
    });

    return {
      business: {
        teachersTotal, teachersActive, teachersArchived,
        studentsTotal, studentsActive, studentsArchived,
        subsActive, subsTrial, subsExpired,
        coursesTotal,
        teacherSeries,
        revenueSeries,
      },
      product: {
        lessonsCompleted, lessonsTotal,
        homeworkDone, homeworkTotal,
        completionRate: lessonsTotal > 0 ? lessonsCompleted / lessonsTotal : 0,
      },
      ops: {
        auditStats: auditStats.map((x) => ({ action: x.action, count: x._count._all })),
      },
    };
  }

  // ============================================================
  // Dashboard (operational overview)
  // ============================================================
  async dashboard() {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 86400000);
    const in3d = new Date(now.getTime() + 3 * 86400000);
    const ago7d = new Date(now.getTime() - 7 * 86400000);
    const ago30d = new Date(now.getTime() - 30 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      teachersTotal, teachersActive, teachersTrial, teachersArchived,
      studentsTotal, studentsActive,
      coursesTotal,
      lessonsToday, lessonsCompletedTotal,
      newTeachers7d, newStudents7d, newTeachers30d, newStudents30d,
      paymentsThisMonth,
      subsExpiringSoon, subsExpired,
      teachersNoStudents, teachersNoCourses,
      recentTeachers, recentStudents, recentSubs, recentAudit,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false, teacherSubscription: { status: 'ACTIVE' } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false, teacherSubscription: { status: 'TRIAL' } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: true } }),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.course.count(),
      this.prisma.lesson.count({
        where: { startAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } },
      }),
      this.prisma.lesson.count({ where: { status: 'COMPLETED' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', createdAt: { gte: ago7d } } }),
      this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: ago7d } } }),
      this.prisma.user.count({ where: { role: 'TEACHER', createdAt: { gte: ago30d } } }),
      this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: ago30d } } }),
      this.prisma.subscription.aggregate({
        where: { startDate: { gte: monthStart }, status: { in: ['ACTIVE', 'TRIAL'] } },
        _sum: { amount: true },
      }),
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
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { actor: { select: { id: true, fullName: true, login: true, role: true } } },
      }),
    ]);

    const activeTeacherIdsRaw = await this.prisma.lesson.findMany({
      where: { startAt: { gte: ago7d } },
      distinct: ['teacherId'],
      select: { teacherId: true },
    });
    const activeIds = new Set(activeTeacherIdsRaw.map((x) => x.teacherId));
    const allActiveTeachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', archived: false },
      select: { id: true, fullName: true, login: true, lastLoginAt: true, createdAt: true },
    });
    const inactiveTeachers = allActiveTeachers
      .filter((t) => !activeIds.has(t.id))
      .slice(0, 10);

    // 12-month growth chart
    const since12m = new Date(); since12m.setMonth(since12m.getMonth() - 11); since12m.setDate(1); since12m.setHours(0, 0, 0, 0);
    const allTeachers = await this.prisma.user.findMany({ where: { role: 'TEACHER', createdAt: { gte: since12m } }, select: { createdAt: true } });
    const allStudents = await this.prisma.user.findMany({ where: { role: 'STUDENT', createdAt: { gte: since12m } }, select: { createdAt: true } });
    const allRevenue = await this.prisma.subscription.findMany({ where: { startDate: { gte: since12m } }, select: { startDate: true, amount: true } });
    const teachersByMonth = bucketByMonth(allTeachers.map((x) => ({ date: x.createdAt, value: 1 })), since12m);
    const studentsByMonth = bucketByMonth(allStudents.map((x) => ({ date: x.createdAt, value: 1 })), since12m);
    const revenueByMonth = bucketByMonth(allRevenue.map((x) => ({ date: x.startDate as Date, value: x.amount || 0 })), since12m);

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
        audit: recentAudit,
      },
      charts: {
        teachersByMonth,
        studentsByMonth,
        revenueByMonth,
      },
    };
  }
}

// ---- helpers ----
function bucketByDay(rows: { date: Date; value: number }[]): { key: string; value: number }[] {
  const map = new Map<string, number>();
  rows.forEach(({ date, value }) => {
    if (!date) return;
    const d = date instanceof Date ? date : new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + value);
  });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({ key, value }));
}

function bucketByMonth(rows: { date: Date; value: number }[], since: Date): { key: string; value: number }[] {
  const map = new Map<string, number>();
  // pre-fill 12 months
  const cur = new Date(since);
  for (let i = 0; i < 12; i++) {
    const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    map.set(k, 0);
    cur.setMonth(cur.getMonth() + 1);
  }
  rows.forEach(({ date, value }) => {
    if (!date) return;
    const d = date instanceof Date ? date : new Date(date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map.has(k)) map.set(k, (map.get(k) || 0) + value);
  });
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}
