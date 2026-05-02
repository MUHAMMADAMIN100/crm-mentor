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
  async listTeachers(opts: { search?: string; status?: string; archived?: string; sort?: string; activity?: string; hasStudents?: string; hasCourses?: string; subType?: string; subEndFrom?: string; subEndTo?: string; limit?: string; offset?: string } = {}) {
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
    // Subscription filters
    const subWhere: any = {};
    if (opts.status && ['TRIAL', 'ACTIVE', 'EXPIRED', 'BLOCKED', 'PAUSED', 'CANCELED'].includes(opts.status)) subWhere.status = opts.status;
    if (opts.subType && ['MONTH', 'YEAR'].includes(opts.subType)) subWhere.type = opts.subType;
    if (opts.subEndFrom || opts.subEndTo) {
      subWhere.endDate = {};
      if (opts.subEndFrom) subWhere.endDate.gte = new Date(opts.subEndFrom);
      if (opts.subEndTo) subWhere.endDate.lte = new Date(opts.subEndTo);
    }
    if (Object.keys(subWhere).length > 0) where.teacherSubscription = subWhere;

    if (opts.hasStudents === 'yes') where.teacherStudents = { some: {} };
    else if (opts.hasStudents === 'no') where.teacherStudents = { none: {} };
    if (opts.hasCourses === 'yes') where.teacherCourses = { some: {} };
    else if (opts.hasCourses === 'no') where.teacherCourses = { none: {} };
    if (opts.activity === '7d') where.lastLoginAt = { gte: new Date(Date.now() - 7 * 86400000) };
    else if (opts.activity === '30d') where.lastLoginAt = { gte: new Date(Date.now() - 30 * 86400000) };
    else if (opts.activity === 'inactive7d') {
      where.OR = [...(where.OR || []), { lastLoginAt: null }, { lastLoginAt: { lt: new Date(Date.now() - 7 * 86400000) } }];
    }

    let orderBy: any = { createdAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'name') orderBy = { fullName: desc ? 'desc' : 'asc' };
    else if (field === 'created') orderBy = { createdAt: desc ? 'desc' : 'asc' };
    else if (field === 'activity') orderBy = { lastLoginAt: desc ? 'desc' : 'asc' };
    else if (field === 'students') orderBy = { teacherStudents: { _count: desc ? 'desc' : 'asc' } };
    else if (field === 'courses') orderBy = { teacherCourses: { _count: desc ? 'desc' : 'asc' } };
    else if (field === 'revenue') orderBy = { teacherSubscription: { amount: desc ? 'desc' : 'asc' } };

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

  /**
   * Bulk-import teachers from a parsed array. Each row needs at minimum
   * fullName + login + password. Returns counts of created vs skipped.
   */
  async bulkImportTeachers(actorId: string, rows: any[]) {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        if (!row?.fullName?.trim() || !row?.login?.trim() || !row?.password) {
          skipped++; errors.push(`${row?.fullName || row?.login || '?'}: пропущены обязательные поля`);
          continue;
        }
        if (String(row.password).length < 6) { skipped++; errors.push(`${row.login}: пароль короче 6 символов`); continue; }
        const exists = await this.prisma.user.findUnique({ where: { login: row.login.trim() } });
        if (exists) { skipped++; errors.push(`${row.login}: логин занят`); continue; }
        await this.createTeacher(actorId, {
          fullName: row.fullName.trim(),
          login: row.login.trim(),
          password: String(row.password),
          email: row.email || undefined,
          phone: row.phone || undefined,
        });
        created++;
      } catch (e: any) {
        skipped++;
        errors.push(`${row?.login || '?'}: ${e?.message || 'ошибка'}`);
      }
    }
    this.audit.log(actorId, 'bulk.importTeachers', { meta: { created, skipped } });
    return { created, skipped, errors: errors.slice(0, 50) };
  }

  /**
   * Bulk-import students for a specific teacher. Each row needs
   * fullName + login + password. Other fields (email, phone, etc.) are
   * optional. Returns counts of created vs skipped.
   */
  async bulkImportStudents(actorId: string, teacherId: string, rows: any[]) {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, role: true } });
    if (!teacher || teacher.role !== 'TEACHER') throw new BadRequestException('Учитель не найден');
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        if (!row?.fullName?.trim() || !row?.login?.trim() || !row?.password) {
          skipped++; errors.push(`${row?.fullName || row?.login || '?'}: пропущены обязательные поля`); continue;
        }
        if (String(row.password).length < 6) { skipped++; errors.push(`${row.login}: пароль короче 6 символов`); continue; }
        const exists = await this.prisma.user.findUnique({ where: { login: row.login.trim() } });
        if (exists) { skipped++; errors.push(`${row.login}: логин занят`); continue; }
        const hash = await AuthService.hashPassword(String(row.password));
        await this.prisma.user.create({
          data: {
            login: row.login.trim(),
            password: hash,
            plainPassword: String(row.password),
            role: 'STUDENT',
            fullName: row.fullName.trim(),
            email: row.email || null,
            phone: row.phone || null,
            telegram: row.telegram || null,
            mustChangePassword: false,
            profileCompleted: !!(row.email || row.phone || row.telegram),
            studentProfile: {
              create: {
                teacherId,
                individualPrice: row.individualPrice ? +row.individualPrice : null,
                tree: { create: {} },
              },
            },
          },
        });
        created++;
      } catch (e: any) {
        skipped++;
        errors.push(`${row?.login || '?'}: ${e?.message || 'ошибка'}`);
      }
    }
    this.audit.log(actorId, 'bulk.importStudents', { meta: { created, skipped, teacherId } });
    return { created, skipped, errors: errors.slice(0, 50) };
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

    // Real income from this teacher's students (Payment.kind=TOPUP).
    const studentIds = (t.teacherStudents || []).map((sp: any) => sp.id);
    const [paymentsAgg, recentStudentPayments] = await Promise.all([
      studentIds.length > 0 ? this.prisma.payment.groupBy({
        by: ['kind'],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true },
      }) : Promise.resolve([] as any),
      studentIds.length > 0 ? this.prisma.payment.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { student: { include: { user: { select: { id: true, fullName: true, login: true } } } } },
      }) : Promise.resolve([] as any),
    ]);
    const incoming = (paymentsAgg as any[]).find((x: any) => x.kind === 'TOPUP')?._sum?.amount || 0;
    const charged = (paymentsAgg as any[]).find((x: any) => x.kind === 'CHARGE')?._sum?.amount || 0;

    return {
      teacher: t,
      stats: {
        lessonsCompleted,
        lessonsPlanned,
        studentIncoming: incoming,
        studentCharged: charged,
        netStudentPayments: incoming - charged,
      },
      recentLessons,
      recentStudentPayments,
      audit,
    };
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
  // Global search (Cmd+K)
  // ============================================================
  async globalSearch(query: string) {
    const q = query.trim();
    if (!q) return { teachers: [], students: [], courses: [], managers: [] };

    const matchTextUser: any = {
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { login: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    };

    const [teachers, students, courses, managers] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'TEACHER', ...matchTextUser },
        select: { id: true, fullName: true, login: true, email: true, archived: true },
        take: 8,
      }),
      this.prisma.user.findMany({
        where: { role: 'STUDENT', ...matchTextUser },
        select: { id: true, fullName: true, login: true, email: true, archived: true },
        take: 8,
      }),
      this.prisma.course.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { teacher: { fullName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, title: true, status: true, teacher: { select: { id: true, fullName: true } } },
        take: 8,
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', ...matchTextUser },
        select: { id: true, fullName: true, login: true, adminLevel: true },
        take: 5,
      }),
    ]);
    return { teachers, students, courses, managers };
  }

  // ============================================================
  // Bell notifications for admin (computed live)
  // ============================================================
  async adminNotifications() {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 86400000);
    const ago7d = new Date(now.getTime() - 7 * 86400000);
    const ago24h = new Date(now.getTime() - 86400000);

    const [expiringSoon, expired, newTeachers24h, newStudents24h, recentPayments] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in7d } },
        include: { teacher: { select: { id: true, fullName: true, login: true } } },
        orderBy: { endDate: 'asc' },
        take: 20,
      }),
      this.prisma.subscription.findMany({
        where: { OR: [{ status: 'EXPIRED' }, { AND: [{ status: 'ACTIVE' }, { endDate: { lt: now } }] }] },
        include: { teacher: { select: { id: true, fullName: true, login: true } } },
        orderBy: { endDate: 'asc' },
        take: 20,
      }),
      this.prisma.user.findMany({
        where: { role: 'TEACHER', createdAt: { gte: ago24h } },
        select: { id: true, fullName: true, login: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: { role: 'STUDENT', createdAt: { gte: ago24h } },
        select: { id: true, fullName: true, login: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionHistory.findMany({
        where: { createdAt: { gte: ago7d }, action: { in: ['extend', 'create'] } },
        include: {
          subscription: { include: { teacher: { select: { id: true, fullName: true, login: true } } } },
          actor: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      total: expiringSoon.length + expired.length + newTeachers24h.length + newStudents24h.length,
      expiringSoon,
      expired,
      newTeachers24h,
      newStudents24h,
      recentPayments,
    };
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
    const sp = u.studentProfile;

    const [lessonsTotal, lessonsCompleted, lessonsPlanned, hwTotal, hwCompleted, hwOverdue, blockProgress, quizSubmissions, audit, chats, recentMessages] = await Promise.all([
      sp ? this.prisma.lesson.count({ where: { studentProfileId: sp.id } }) : Promise.resolve(0),
      sp ? this.prisma.lesson.count({ where: { studentProfileId: sp.id, status: 'COMPLETED' } }) : Promise.resolve(0),
      sp ? this.prisma.lesson.count({ where: { studentProfileId: sp.id, status: 'PLANNED' } }) : Promise.resolve(0),
      this.prisma.homeworkSubmission.count({ where: { studentId: studentUserId } }),
      this.prisma.homeworkSubmission.count({ where: { studentId: studentUserId, status: 'COMPLETED' } }),
      this.prisma.homeworkSubmission.count({ where: { studentId: studentUserId, status: 'OVERDUE' } }),
      this.prisma.blockProgress.count({ where: { studentId: studentUserId } }),
      this.prisma.quizSubmission.findMany({
        where: { studentId: studentUserId },
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ targetId: studentUserId }, { actorId: studentUserId }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { actor: { select: { id: true, fullName: true, login: true } } },
      }),
      this.prisma.chat.findMany({
        where: { members: { some: { userId: studentUserId } } },
        select: { id: true, title: true, type: true, members: { include: { user: { select: { id: true, fullName: true, login: true, role: true } } } } },
      }),
      this.prisma.message.findMany({
        where: { chat: { members: { some: { userId: studentUserId } } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { sender: { select: { id: true, fullName: true, role: true } } },
      }),
    ]);

    const avgQuiz = quizSubmissions.length > 0
      ? Math.round(quizSubmissions.reduce((s: number, x: any) => s + (x.score || 0), 0) / quizSubmissions.length * 100)
      : 0;
    const attendance = lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0;
    const hwCompletion = hwTotal > 0 ? Math.round((hwCompleted / hwTotal) * 100) : 0;

    return {
      user: u,
      stats: {
        lessonsCount: lessonsTotal,
        lessonsCompleted,
        lessonsPlanned,
        attendance,
        hwTotal,
        hwCompleted,
        hwOverdue,
        hwCompletion,
        blockProgress,
        avgQuizScore: avgQuiz,
        quizCount: quizSubmissions.length,
      },
      audit,
      chats,
      recentMessages,
    };
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
  async listCourses(opts: { search?: string; status?: string; teacherId?: string; format?: string; sort?: string; limit?: string; offset?: string } = {}) {
    const where: any = {};
    if (opts.status && ['DRAFT', 'PUBLISHED_PRIVATE', 'ARCHIVED'].includes(opts.status)) where.status = opts.status;
    if (opts.teacherId) where.teacherId = opts.teacherId;
    if (opts.format && opts.format !== 'all') where.format = opts.format;
    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    let orderBy: any = { createdAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'title') orderBy = { title: desc ? 'desc' : 'asc' };
    else if (field === 'created') orderBy = { createdAt: desc ? 'desc' : 'asc' };
    else if (field === 'updated') orderBy = { updatedAt: desc ? 'desc' : 'asc' };
    else if (field === 'modules') orderBy = { modules: { _count: desc ? 'desc' : 'asc' } };
    else if (field === 'students') orderBy = { accesses: { _count: desc ? 'desc' : 'asc' } };

    const take = opts.limit ? Math.min(500, Math.max(1, +opts.limit)) : undefined;
    const skip = opts.offset ? Math.max(0, +opts.offset) : undefined;
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: { teacher: { select: { id: true, fullName: true, login: true } }, _count: { select: { modules: true, accesses: true } } },
        orderBy, take, skip,
      }),
      take !== undefined ? this.prisma.course.count({ where }) : Promise.resolve(undefined),
    ]);
    if (take !== undefined) return { items, total };
    return items;
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

  async setCourseFormat(actorId: string, courseId: string, format: string) {
    const c = await this.prisma.course.update({ where: { id: courseId }, data: { format: format || null } });
    this.audit.log(actorId, 'course.format', { targetType: 'Course', targetId: courseId, meta: { format } });
    return c;
  }

  /**
   * Per-student progress for a single course: sum of completed blocks /
   * total blocks across all lessons of this course.
   */
  async courseProgress(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: { include: { lessons: { include: { blocks: { select: { id: true } } } } } },
        accesses: { include: { student: { include: { user: { select: { id: true, fullName: true, login: true } } } } } },
      },
    });
    if (!course) throw new NotFoundException();
    const blockIds: string[] = [];
    course.modules.forEach((m: any) => m.lessons.forEach((l: any) => l.blocks.forEach((b: any) => blockIds.push(b.id))));
    const totalBlocks = blockIds.length;
    if (totalBlocks === 0) return { totalBlocks: 0, students: [] };
    const studentUserIds = course.accesses.map((a: any) => a.student.user.id);
    const progress = studentUserIds.length > 0 ? await this.prisma.blockProgress.findMany({
      where: { studentId: { in: studentUserIds }, blockId: { in: blockIds }, done: true },
      select: { studentId: true },
    }) : [];
    const doneByUser = new Map<string, number>();
    progress.forEach((p: any) => doneByUser.set(p.studentId, (doneByUser.get(p.studentId) || 0) + 1));

    const students = course.accesses.map((a: any) => {
      const done = doneByUser.get(a.student.user.id) || 0;
      return {
        accessId: a.id,
        studentId: a.student.user.id,
        studentProfileId: a.student.id,
        fullName: a.student.user.fullName,
        login: a.student.user.login,
        done,
        total: totalBlocks,
        percent: totalBlocks > 0 ? Math.round((done / totalBlocks) * 100) : 0,
      };
    }).sort((a: any, b: any) => b.percent - a.percent);

    const avgPercent = students.length > 0
      ? Math.round(students.reduce((s: number, x: any) => s + x.percent, 0) / students.length)
      : 0;
    return { totalBlocks, avgPercent, students };
  }

  /** Mass-extend the subscriptions for a list of teachers by N months. */
  async bulkExtendSubscriptions(actorId: string, teacherIds: string[], months: number, comment?: string) {
    let updated = 0;
    for (const tid of teacherIds) {
      try {
        await this.extendSubscription(actorId, tid, months, undefined, comment);
        updated++;
      } catch { /* swallow individual errors */ }
    }
    this.audit.log(actorId, 'bulk.extendSubs', { meta: { count: updated, months } });
    return { count: updated };
  }

  /** Mass-set status on subscriptions for a list of teachers. */
  async bulkSetSubStatus(actorId: string, teacherIds: string[], status: any, comment?: string) {
    let updated = 0;
    for (const tid of teacherIds) {
      try {
        await this.setSubscriptionStatus(actorId, tid, status, comment);
        updated++;
      } catch { /* swallow */ }
    }
    this.audit.log(actorId, 'bulk.setSubStatus', { meta: { count: updated, status } });
    return { count: updated };
  }

  /** Toggle the hidden flag (independent of archive). Hidden courses don't show in catalog/learners. */
  async toggleCourseHidden(actorId: string, courseId: string) {
    const cur = await this.prisma.course.findUnique({ where: { id: courseId }, select: { hidden: true } });
    if (!cur) throw new NotFoundException();
    const c = await this.prisma.course.update({ where: { id: courseId }, data: { hidden: !cur.hidden } });
    this.audit.log(actorId, 'course.hidden', { targetType: 'Course', targetId: courseId, meta: { hidden: c.hidden } });
    return c;
  }

  /**
   * Deep-copy a course (modules + lessons + blocks). Accesses, groups, and
   * student progress are NOT copied — the duplicate starts fresh as a DRAFT.
   */
  async duplicateCourse(actorId: string, courseId: string) {
    const src = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { modules: { include: { lessons: { include: { blocks: true } } } } },
    });
    if (!src) throw new NotFoundException();
    const copy = await this.prisma.course.create({
      data: {
        teacherId: src.teacherId,
        title: `${src.title} (копия)`,
        description: src.description,
        category: src.category,
        price: src.price,
        status: 'DRAFT',
        hidden: false,
        modules: {
          create: src.modules.map((m: any) => ({
            title: m.title,
            position: m.position,
            lessons: {
              create: m.lessons.map((l: any) => ({
                title: l.title,
                position: l.position,
                isHomework: l.isHomework,
                deadlineMode: l.deadlineMode,
                deadlineAt: l.deadlineAt,
                aiHelper: l.aiHelper,
                blocks: {
                  create: l.blocks.map((b: any) => ({
                    type: b.type,
                    position: b.position,
                    isHomework: b.isHomework,
                    videoUrls: b.videoUrls,
                    textTitle: b.textTitle,
                    textBody: b.textBody,
                    miniQuizQuestion: b.miniQuizQuestion,
                    miniQuizAnswer: b.miniQuizAnswer,
                    fileUrls: b.fileUrls,
                    writtenPrompt: b.writtenPrompt,
                    writtenHint: b.writtenHint,
                    quizKind: b.quizKind,
                    quizPayload: b.quizPayload as any,
                    quizCorrect: b.quizCorrect as any,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
    this.audit.log(actorId, 'course.duplicate', { targetType: 'Course', targetId: copy.id, meta: { sourceId: src.id } });
    return copy;
  }

  // ============================================================
  // Finance
  // ============================================================
  async finance(opts: { search?: string; status?: string; period?: string; source?: string; managerId?: string; subType?: string; sort?: string; limit?: string; offset?: string } = {}) {
    const where: any = {};
    if (opts.status && opts.status !== 'all') where.status = opts.status;
    if (opts.source && opts.source !== 'all') where.source = opts.source;
    if (opts.subType && ['MONTH', 'YEAR'].includes(opts.subType)) where.type = opts.subType;
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
    if (opts.managerId && opts.managerId !== 'all') {
      const latest = await this.prisma.subscriptionHistory.findMany({
        where: { actorId: opts.managerId },
        select: { subscriptionId: true },
        distinct: ['subscriptionId'],
      });
      where.id = { in: latest.map((h) => h.subscriptionId) };
    }

    // Sort
    let orderBy: any = { updatedAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'amount') orderBy = { amount: desc ? 'desc' : 'asc' };
    else if (field === 'endDate') orderBy = { endDate: desc ? 'desc' : 'asc' };
    else if (field === 'startDate') orderBy = { startDate: desc ? 'desc' : 'asc' };
    else if (field === 'status') orderBy = { status: desc ? 'desc' : 'asc' };
    else if (field === 'updated') orderBy = { updatedAt: desc ? 'desc' : 'asc' };

    const take = opts.limit ? Math.min(500, Math.max(1, +opts.limit)) : undefined;
    const skip = opts.offset ? Math.max(0, +opts.offset) : undefined;

    const [subs, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          teacher: { select: { id: true, fullName: true, login: true, email: true, archived: true } },
          history: { orderBy: { createdAt: 'desc' }, take: 1, include: { actor: { select: { id: true, fullName: true, login: true } } } },
        },
        orderBy,
        take, skip,
      }),
      take !== undefined ? this.prisma.subscription.count({ where }) : Promise.resolve(undefined),
    ]);

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
      total,
    };
  }

  // ============================================================
  // Analytics
  // ============================================================
  async analytics(opts: { period?: string; from?: string; to?: string } = {}) {
    const now = new Date();
    let cutoff: Date;
    let periodEnd = now;
    if (opts.from && opts.to) {
      cutoff = new Date(opts.from);
      periodEnd = new Date(opts.to);
    } else {
      const periodDays = opts.period === 'today' ? 1
        : opts.period === '7d' ? 7
        : opts.period === '30d' ? 30
        : opts.period === '90d' ? 90
        : opts.period === 'quarter' ? 90
        : opts.period === 'all' ? 3650
        : 30;
      cutoff = new Date(now.getTime() - periodDays * 86400000);
    }

    const [
      teachersTotal, teachersActive, teachersArchived,
      studentsTotal, studentsActive, studentsArchived,
      coursesTotal,
      lessonsCompleted, lessonsTotal,
      homeworkDone, homeworkTotal,
      subsActive, subsTrial, subsExpired,
      teacherRegistrationsByDay,
      revenueByDay,
      // DAU / WAU / MAU based on lastLoginAt
      dauUsers,
      wauUsers,
      mauUsers,
      // Trial→Paid conversion
      trialHistory,
      paidHistory,
      // Average check (active subs that have an amount)
      paidSubsForAvg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: false } }),
      this.prisma.user.count({ where: { role: 'TEACHER', archived: true } }),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: false } }),
      this.prisma.user.count({ where: { role: 'STUDENT', archived: true } }),
      this.prisma.course.count(),
      this.prisma.lesson.count({ where: { status: 'COMPLETED', startAt: { gte: cutoff, lte: periodEnd } } }),
      this.prisma.lesson.count({ where: { startAt: { gte: cutoff, lte: periodEnd } } }),
      this.prisma.homeworkSubmission.count({ where: { status: 'COMPLETED', updatedAt: { gte: cutoff, lte: periodEnd } } }),
      this.prisma.homeworkSubmission.count({ where: { updatedAt: { gte: cutoff, lte: periodEnd } } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: cutoff, lte: periodEnd } },
        select: { createdAt: true, role: true },
      }),
      this.prisma.subscription.findMany({
        where: { startDate: { gte: cutoff, lte: periodEnd } },
        select: { startDate: true, amount: true },
      }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 86400000) } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 7 * 86400000) } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
      this.prisma.subscriptionHistory.findMany({
        where: { createdAt: { gte: cutoff, lte: periodEnd }, prevStatus: 'TRIAL' },
        select: { id: true, prevStatus: true, nextStatus: true },
      }),
      this.prisma.subscriptionHistory.findMany({
        where: { createdAt: { gte: cutoff, lte: periodEnd }, prevStatus: 'TRIAL', nextStatus: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', amount: { not: null } },
        select: { amount: true, type: true },
      }),
    ]);

    // Group by day, split by role
    const teacherSeries = bucketByDay(teacherRegistrationsByDay.filter((x: any) => x.role === 'TEACHER').map((x: any) => ({ date: x.createdAt, value: 1 })));
    const studentSeries = bucketByDay(teacherRegistrationsByDay.filter((x: any) => x.role === 'STUDENT').map((x: any) => ({ date: x.createdAt, value: 1 })));
    const revenueSeries = bucketByDay(revenueByDay.map((x: any) => ({ date: x.startDate as Date, value: x.amount || 0 })));

    // Trial → Paid conversion = paid / total trial-changes-to-anything within period
    const trialConversion = trialHistory.length > 0 ? paidHistory.length / trialHistory.length : 0;

    // Average check — for monthly equivalence: yearly subs / 12
    const monthlyAmounts = paidSubsForAvg.map((s: any) => (s.amount || 0) / (s.type === 'YEAR' ? 12 : 1));
    const avgCheck = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((s, x) => s + x, 0) / monthlyAmounts.length : 0;

    // Operational metrics from audit log
    const auditStats = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: cutoff, lte: periodEnd } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 30,
    });

    return {
      period: { from: cutoff.toISOString(), to: periodEnd.toISOString() },
      business: {
        teachersTotal, teachersActive, teachersArchived,
        studentsTotal, studentsActive, studentsArchived,
        subsActive, subsTrial, subsExpired,
        coursesTotal,
        teacherSeries,
        studentSeries,
        revenueSeries,
        trialConversion,
        avgCheck,
      },
      product: {
        lessonsCompleted, lessonsTotal,
        homeworkDone, homeworkTotal,
        completionRate: lessonsTotal > 0 ? lessonsCompleted / lessonsTotal : 0,
        dau: dauUsers,
        wau: wauUsers,
        mau: mauUsers,
        // Stickiness — how often the average WAU user shows up daily
        stickiness: wauUsers > 0 ? dauUsers / wauUsers : 0,
      },
      ops: {
        auditStats: auditStats.map((x: any) => ({ action: x.action, count: x._count._all })),
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
