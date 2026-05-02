import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from './audit.service';

const ALL_PERMISSIONS = [
  'view',
  'edit_users',
  'manage_finance',
  'manage_subscriptions',
  'view_analytics',
  'manage_managers',
  'manage_courses',
  'manage_system',
  'delete',
];

@Injectable()
export class ManagersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** All admin-role users (super_admin, admin, support, sales). */
  async list(opts: { search?: string; sort?: string; limit?: string; offset?: string } = {}) {
    const where: any = { role: 'ADMIN' };
    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    let orderBy: any = { createdAt: 'desc' };
    const sort = opts.sort || '';
    const desc = sort.startsWith('-');
    const field = sort.replace(/^-/, '');
    if (field === 'name') orderBy = { fullName: desc ? 'desc' : 'asc' };
    else if (field === 'created') orderBy = { createdAt: desc ? 'desc' : 'asc' };
    else if (field === 'activity') orderBy = { lastLoginAt: desc ? 'desc' : 'asc' };
    else if (field === 'role') orderBy = { adminLevel: desc ? 'desc' : 'asc' };

    const take = opts.limit ? Math.min(500, Math.max(1, +opts.limit)) : undefined;
    const skip = opts.offset ? Math.max(0, +opts.offset) : undefined;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, login: true, fullName: true, email: true, phone: true, telegram: true,
          adminLevel: true, permissions: true, archived: true, lastLoginAt: true, createdAt: true,
        },
        orderBy, take, skip,
      }),
      take !== undefined ? this.prisma.user.count({ where }) : Promise.resolve(undefined),
    ]);
    if (take !== undefined) return { items, total };
    return items;
  }

  permissionsCatalog() {
    return ALL_PERMISSIONS;
  }

  async create(actorId: string, data: { fullName: string; login: string; password: string; email?: string; phone?: string; telegram?: string; adminLevel: string; permissions: string[] }) {
    await this.assertActorIsSuperOrCanManage(actorId);
    if (!data.fullName || !data.login || !data.password) throw new BadRequestException('Заполните ФИО, логин и пароль');
    if (data.password.length < 6) throw new BadRequestException('Пароль не короче 6 символов');
    if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'SALES'].includes(data.adminLevel)) throw new BadRequestException('Неверная роль');
    const exists = await this.prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new BadRequestException('Логин уже занят');
    const hash = await AuthService.hashPassword(data.password);
    const u = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hash,
        plainPassword: data.password,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        telegram: data.telegram || null,
        role: 'ADMIN',
        adminLevel: data.adminLevel as any,
        permissions: (data.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p)).join(','),
        mustChangePassword: false,
        profileCompleted: true,
      },
    });
    this.audit.log(actorId, 'manager.create', { targetType: 'User', targetId: u.id, meta: { adminLevel: data.adminLevel } });
    const { password, ...rest } = u as any;
    return rest;
  }

  async update(actorId: string, id: string, data: any) {
    await this.assertActorIsSuperOrCanManage(actorId);
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== 'ADMIN') throw new NotFoundException();
    // Prevent demoting yourself or other super admins (except by other super admin themselves)
    if (target.adminLevel === 'SUPER_ADMIN' && data.adminLevel && data.adminLevel !== 'SUPER_ADMIN') {
      const me = await this.prisma.user.findUnique({ where: { id: actorId }, select: { adminLevel: true } });
      if (me?.adminLevel !== 'SUPER_ADMIN') throw new ForbiddenException('Только super admin может менять роль другого super admin');
    }
    if (data.login && data.login !== target.login) {
      const taken = await this.prisma.user.findFirst({ where: { login: data.login, NOT: { id } }, select: { id: true } });
      if (taken) throw new BadRequestException('Логин уже занят');
    }
    const u = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName ?? undefined,
        login: data.login ?? undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        telegram: data.telegram ?? undefined,
        adminLevel: data.adminLevel ?? undefined,
        permissions: Array.isArray(data.permissions) ? data.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p)).join(',') : undefined,
        ...(data.password
          ? { password: await AuthService.hashPassword(data.password), plainPassword: data.password, mustChangePassword: false }
          : {}),
      },
    });
    this.audit.log(actorId, 'manager.edit', { targetType: 'User', targetId: id, meta: { fields: Object.keys(data) } });
    const { password, ...rest } = u as any;
    return rest;
  }

  async stats(managerId: string) {
    const [creates, archives, edits, subs, total] = await Promise.all([
      this.prisma.auditLog.count({ where: { actorId: managerId, action: { contains: '.create' } } }),
      this.prisma.auditLog.count({ where: { actorId: managerId, action: { contains: '.archive' } } }),
      this.prisma.auditLog.count({ where: { actorId: managerId, action: { contains: '.edit' } } }),
      this.prisma.auditLog.count({ where: { actorId: managerId, action: { startsWith: 'subscription.' } } }),
      this.prisma.auditLog.count({ where: { actorId: managerId } }),
    ]);
    return { creates, archives, edits, subs, total };
  }

  private async assertActorIsSuperOrCanManage(actorId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: actorId }, select: { adminLevel: true, permissions: true } });
    if (!me) throw new ForbiddenException();
    if (me.adminLevel === 'SUPER_ADMIN') return;
    if (me.adminLevel === 'ADMIN' && (me.permissions || '').split(',').includes('manage_managers')) return;
    throw new ForbiddenException('Недостаточно прав для управления менеджерами');
  }
}
