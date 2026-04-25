import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Логика дерева:
 *   уровень = функция от completedCount: 0 → 0; 2 → 1; 4 → 2; 6 → 3; 8 → 4; 10+ → 5 (рекорд)
 *   1 просрочка: redFrame=true, level -= 1 (но >= 0)
 *   2 просрочки подряд: withered=true, всё обнуляется
 *   успешная домашка после просрочки сбрасывает redFrame и обнуляет overdueCount
 */
@Injectable()
export class TreeService {
  constructor(private prisma: PrismaService) {}

  static levelFromCount(c: number): number {
    if (c >= 10) return 5;
    if (c >= 8) return 4;
    if (c >= 6) return 3;
    if (c >= 4) return 2;
    if (c >= 2) return 1;
    return 0;
  }

  async getOrCreate(studentProfileId: string) {
    const t = await this.prisma.motivationTree.findUnique({ where: { studentId: studentProfileId } });
    if (t) return t;
    return this.prisma.motivationTree.create({ data: { studentId: studentProfileId } });
  }

  async onHomeworkCompleted(studentProfileId: string) {
    const t = await this.getOrCreate(studentProfileId);
    if (t.withered) {
      // restart fresh
      return this.prisma.motivationTree.update({
        where: { studentId: studentProfileId },
        data: {
          withered: false,
          redFrame: false,
          completedCount: 1,
          overdueCount: 0,
          level: TreeService.levelFromCount(1),
        },
      });
    }
    const newCount = t.completedCount + 1;
    return this.prisma.motivationTree.update({
      where: { studentId: studentProfileId },
      data: {
        completedCount: newCount,
        level: TreeService.levelFromCount(newCount),
        redFrame: false,
        overdueCount: 0,
      },
    });
  }

  async onHomeworkOverdue(studentProfileId: string) {
    const t = await this.getOrCreate(studentProfileId);
    if (t.withered) return t;
    const newOverdue = t.overdueCount + 1;
    if (newOverdue >= 2) {
      return this.prisma.motivationTree.update({
        where: { studentId: studentProfileId },
        data: {
          withered: true,
          redFrame: false,
          completedCount: 0,
          level: 0,
          overdueCount: 0,
        },
      });
    }
    const newLevel = Math.max(0, t.level - 1);
    return this.prisma.motivationTree.update({
      where: { studentId: studentProfileId },
      data: { redFrame: true, level: newLevel, overdueCount: newOverdue },
    });
  }

  async getForStudent(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { tree: true } });
    if (!sp) return null;
    if (!sp.tree) return this.getOrCreate(sp.id);
    return sp.tree;
  }

  async garden(teacherId: string) {
    return this.prisma.studentProfile.findMany({
      where: { teacherId, user: { archived: false } },
      include: { user: true, tree: true },
    });
  }
}
