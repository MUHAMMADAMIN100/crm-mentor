import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService, private chat: ChatService) {}

  async listForTeacher(teacherId: string) {
    return this.prisma.studentProfile.findMany({
      where: { teacherId, user: { archived: false } },
      include: { user: true, tree: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStudent(
    teacherId: string,
    data: any,
  ) {
    if (!data?.login || !data?.password || !data?.fullName) {
      throw new BadRequestException('Заполните ФИО, логин и пароль');
    }
    const exists = await this.prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new BadRequestException('Логин уже занят');
    const hash = await AuthService.hashPassword(data.password);
    const created = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hash,
        // Teacher chose this password and may need to share it with the student
        // again later — keep a plaintext copy.
        plainPassword: data.password,
        role: 'STUDENT',
        fullName: data.fullName,
        // Teacher sets a permanent password right away — no forced reset on first login.
        mustChangePassword: false,
        // Optional profile fields — teacher can fill them when creating a student.
        email: data.email || null,
        phone: data.phone || null,
        telegram: data.telegram || null,
        whatsapp: data.whatsapp || null,
        instagram: data.instagram || null,
        website: data.website || null,
        goal: data.goal || null,
        bio: data.bio || null,
        city: data.city || null,
        // Treat the profile as completed so the student lands on dashboard, not on the wizard.
        profileCompleted: !!(data.email || data.phone || data.telegram),
        studentProfile: {
          create: {
            teacherId,
            individualPrice: data.individualPrice ?? null,
            allowReschedule: !!data.allowReschedule,
            tree: { create: {} },
          },
        },
      },
      include: { studentProfile: { include: { tree: true } } },
    });

    // Auto-create a private chat between teacher and the new student so the
    // student appears immediately in the teacher's chat list (and vice-versa).
    try {
      const chat = await this.chat.getOrCreatePrivate(teacherId, created.id);
      // Seed a welcome message only if the chat has none yet (idempotent on re-runs).
      const msgCount = await this.prisma.message.count({ where: { chatId: chat.id } });
      if (msgCount === 0) {
        await this.prisma.message.create({
          data: {
            chatId: chat.id,
            senderId: teacherId,
            kind: 'TEXT',
            text: `Привет, ${data.fullName}! Это наш рабочий чат — пиши сюда любые вопросы.`,
          },
        });
      }
    } catch (e) {
      // Don't fail student creation if chat creation hiccups; log only.
      console.error('[students.createStudent] chat init failed:', e);
    }

    return created;
  }

  async getById(teacherId: string, studentProfileId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        user: true,
        tree: true,
        groups: { include: { group: true } },
        courseAccesses: { include: { course: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sp) throw new NotFoundException();
    if (sp.teacherId !== teacherId) throw new ForbiddenException();
    return sp;
  }

  async updateSettings(teacherId: string, profileId: string, data: { allowReschedule?: boolean; individualPrice?: number }) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!sp || sp.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.studentProfile.update({
      where: { id: profileId },
      data: {
        allowReschedule: data.allowReschedule ?? undefined,
        individualPrice: data.individualPrice ?? undefined,
      },
    });
  }

  /** Teacher edits the personal profile fields of one of their own students. */
  async updateStudentProfile(teacherId: string, profileId: string, data: any) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!sp || sp.teacherId !== teacherId) throw new ForbiddenException();

    // If teacher wants to change the login, make sure it's not taken by another user.
    if (data.login && data.login.trim()) {
      const taken = await this.prisma.user.findFirst({
        where: { login: data.login.trim(), NOT: { id: sp.userId } },
        select: { id: true },
      });
      if (taken) throw new BadRequestException('Логин уже занят');
    }

    const updated = await this.prisma.user.update({
      where: { id: sp.userId },
      data: {
        fullName: data.fullName ?? undefined,
        login: data.login?.trim() || undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        telegram: data.telegram ?? undefined,
        whatsapp: data.whatsapp ?? undefined,
        instagram: data.instagram ?? undefined,
        website: data.website ?? undefined,
        city: data.city ?? undefined,
        goal: data.goal ?? undefined,
        bio: data.bio ?? undefined,
        ...(data.password
          ? {
              password: await AuthService.hashPassword(data.password),
              plainPassword: data.password,
              mustChangePassword: false,
            }
          : {}),
      },
    });
    const { password, ...rest } = updated as any;
    return rest;
  }

  async archive(teacherId: string, profileId: string) {
    const sp = await this.prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!sp || sp.teacherId !== teacherId) throw new ForbiddenException();
    return this.prisma.user.update({ where: { id: sp.userId }, data: { archived: true } });
  }

  async studentDashboard(userId: string) {
    const sp = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        tree: true,
        courseAccesses: {
          include: {
            course: { include: { modules: { include: { lessons: true } } } },
          },
        },
      },
    });
    if (!sp) throw new NotFoundException();

    const upcomingLessons = await this.prisma.lesson.findMany({
      where: {
        OR: [
          { studentProfileId: sp.id },
          { group: { members: { some: { studentId: sp.id } } } },
        ],
        startAt: { gte: new Date() },
        status: 'PLANNED',
      },
      orderBy: { startAt: 'asc' },
      take: 5,
    });

    const homeworks = await this.prisma.homeworkSubmission.findMany({
      where: { studentId: userId, status: { in: ['IN_PROGRESS', 'OVERDUE'] } },
      include: { courseLesson: true },
      orderBy: { updatedAt: 'desc' },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return { profile: sp, upcomingLessons, homeworks, notifications };
  }
}
