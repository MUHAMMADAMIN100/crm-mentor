import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async myChats(userId: string) {
    // Backfill: ensure every (teacher <-> student) link has a PRIVATE chat,
    // so legacy users created before auto-chat existed still see each other.
    await this.ensureRoleChats(userId);

    return this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ensures the current user has a PRIVATE chat with every counterparty
   * required by the data model:
   *   - TEACHER: chat with each of their students
   *   - STUDENT: chat with their teacher
   * Idempotent: skips pairs that already have a chat.
   */
  private async ensureRoleChats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    if (user.role === 'TEACHER') {
      const profiles = await this.prisma.studentProfile.findMany({
        where: { teacherId: userId, user: { archived: false } },
        select: { userId: true },
      });
      for (const sp of profiles) {
        await this.getOrCreatePrivate(userId, sp.userId);
      }
    } else if (user.role === 'STUDENT') {
      const sp = await this.prisma.studentProfile.findUnique({
        where: { userId },
        select: { teacherId: true },
      });
      if (sp?.teacherId) {
        await this.getOrCreatePrivate(userId, sp.teacherId);
      }
    }
  }

  async getOrCreatePrivate(userAId: string, userBId: string) {
    const existing = await this.prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId: userAId } } },
          { members: { some: { userId: userBId } } },
        ],
      },
    });
    if (existing) return existing;
    return this.prisma.chat.create({
      data: {
        type: 'PRIVATE',
        members: { create: [{ userId: userAId }, { userId: userBId }] },
      },
    });
  }

  async getMessages(userId: string, chatId: string) {
    const m = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!m) throw new ForbiddenException();
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async sendMessage(userId: string, chatId: string, body: { text?: string; kind?: string; fileUrl?: string }) {
    const m = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!m) throw new ForbiddenException();
    return this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        text: body.text || null,
        kind: (body.kind as any) || 'TEXT',
        fileUrl: body.fileUrl || null,
      },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  /** Открыть/получить общий служебный чат Miz Support для пользователя */
  async ensureSupportChat(userId: string) {
    let chat = await this.prisma.chat.findFirst({
      where: { type: 'MIZ_SUPPORT', members: { some: { userId } } },
    });
    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          type: 'MIZ_SUPPORT',
          title: 'Miz Support',
          members: { create: [{ userId }] },
        },
      });
    }
    return chat;
  }
}
