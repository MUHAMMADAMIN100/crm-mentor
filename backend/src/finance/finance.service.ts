import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async teacherSummary(teacherId: string) {
    const students = await this.prisma.studentProfile.findMany({
      where: { teacherId },
      include: { user: true },
    });
    const studentIds = students.map((s) => s.id);
    const payments = await this.prisma.payment.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const totalIncome = payments.filter((p) => p.kind === 'TOPUP').reduce((s, p) => s + p.amount, 0);
    const totalCharged = payments.filter((p) => p.kind === 'CHARGE').reduce((s, p) => s + p.amount, 0);
    const totalDebt = students.reduce((s, st) => (st.balance < 0 ? s + Math.abs(st.balance) : s), 0);
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
    return {
      currency: teacher?.teacherCurrency || 'RUB',
      students: students.map((s) => ({
        id: s.id,
        userId: s.userId,
        fullName: s.user.fullName,
        balance: s.balance,
        individualPrice: s.individualPrice,
      })),
      totals: { totalIncome, totalCharged, totalDebt },
      recentPayments: payments,
    };
  }

  async addPayment(teacherId: string, studentProfileId: string, body: { amount: number; comment?: string }) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
    if (!sp) throw new NotFoundException();
    if (sp.teacherId !== teacherId) throw new ForbiddenException();
    await this.prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { balance: { increment: body.amount } },
    });
    return this.prisma.payment.create({
      data: { studentId: studentProfileId, kind: 'TOPUP', amount: body.amount, comment: body.comment || null },
    });
  }

  async studentBalance(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!sp) throw new NotFoundException();
    const teacher = await this.prisma.user.findUnique({ where: { id: sp.teacherId } });
    return {
      balance: sp.balance,
      currency: teacher?.teacherCurrency || 'RUB',
      payments: sp.payments,
    };
  }
}
