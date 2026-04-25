import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async listFreeSlotsForTeacher(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, fullName: true, role: true },
    });
    if (!teacher || teacher.role !== 'TEACHER') throw new NotFoundException();
    const slots = await this.prisma.freeSlot.findMany({
      where: { teacherId, takenById: null, startAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
    });
    return { teacher, slots };
  }

  async bookSlot(slug: string, body: { name: string; contact: string }) {
    const slot = await this.prisma.freeSlot.findUnique({ where: { publicSlug: slug } });
    if (!slot) throw new NotFoundException();
    if (slot.takenById || slot.takenName) throw new BadRequestException('Слот уже занят');
    const updated = await this.prisma.freeSlot.update({
      where: { id: slot.id },
      data: { takenName: body.name, takenContact: body.contact },
    });
    await this.prisma.notification.create({
      data: {
        userId: slot.teacherId,
        kind: 'BOOKING',
        title: 'Новая запись',
        body: `${body.name} (${body.contact}) записан(а) на ${slot.startAt.toLocaleString('ru-RU')}`,
      },
    });
    return updated;
  }
}
