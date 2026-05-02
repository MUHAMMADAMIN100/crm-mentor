import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Persists every sensitive admin action so the audit trail is queryable.
 * Failures here must never break the actual user-facing operation, so the
 * write is fire-and-forget.
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(actorId: string, action: string, opts: { targetType?: string; targetId?: string; meta?: any } = {}) {
    this.prisma.auditLog
      .create({
        data: {
          actorId,
          action,
          targetType: opts.targetType,
          targetId: opts.targetId,
          meta: opts.meta ?? undefined,
        },
      })
      .catch((e) => {
        console.error('[audit] failed to write log', action, e);
      });
  }

  /** List recent audit entries for the activity feed. */
  async list(limit = 100, offset = 0, filter: { actorId?: string; action?: string; targetId?: string; sort?: string } = {}) {
    const sort = filter.sort || '';
    const desc = sort.startsWith('-') || !sort;
    const field = sort.replace(/^-/, '') || 'createdAt';
    const orderBy: any = field === 'action' ? { action: desc ? 'desc' : 'asc' } : { createdAt: desc ? 'desc' : 'asc' };

    const where = {
      actorId: filter.actorId,
      action: filter.action ? { contains: filter.action } : undefined,
      targetId: filter.targetId,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, login: true, role: true, adminLevel: true } } },
        orderBy,
        skip: offset,
        take: Math.min(500, limit),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  count(filter: { actorId?: string; action?: string } = {}) {
    return this.prisma.auditLog.count({
      where: {
        actorId: filter.actorId,
        action: filter.action ? { contains: filter.action } : undefined,
      },
    });
  }
}
