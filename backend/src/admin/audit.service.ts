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
  async list(limit = 100, offset = 0, filter: { actorId?: string; action?: string; targetId?: string } = {}) {
    return this.prisma.auditLog.findMany({
      where: {
        actorId: filter.actorId,
        action: filter.action ? { contains: filter.action } : undefined,
        targetId: filter.targetId,
      },
      include: { actor: { select: { id: true, fullName: true, login: true, role: true, adminLevel: true } } },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Math.min(500, limit),
    });
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
