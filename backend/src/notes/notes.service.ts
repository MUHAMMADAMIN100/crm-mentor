import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const n = await this.prisma.note.findUnique({ where: { userId } });
    if (n) return n;
    return this.prisma.note.create({ data: { userId, body: '' } });
  }

  async save(userId: string, body: string) {
    if (body && body.length > 1000) throw new BadRequestException('Лимит 1000 символов');
    return this.prisma.note.upsert({
      where: { userId },
      update: { body: body || '' },
      create: { userId, body: body || '' },
    });
  }
}
