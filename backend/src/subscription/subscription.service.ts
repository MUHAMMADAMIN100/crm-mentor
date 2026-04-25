import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  get(teacherId: string) {
    return this.prisma.subscription.findUnique({ where: { teacherId } });
  }
}
