import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  list(teacherId: string) {
    return this.prisma.group.findMany({
      where: { teacherId },
      include: { members: { include: { student: { include: { user: true } } } }, course: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    teacherId: string,
    body: { name: string; courseId?: string; members: { studentProfileId: string; pricePerLesson: number }[] },
  ) {
    const group = await this.prisma.group.create({
      data: {
        teacherId,
        name: body.name,
        courseId: body.courseId || null,
        members: {
          create: body.members.map((m) => ({
            studentId: m.studentProfileId,
            pricePerLesson: m.pricePerLesson,
          })),
        },
      },
      include: { members: true },
    });
    // create chat
    const chat = await this.prisma.chat.create({
      data: { type: 'GROUP', title: body.name, groupId: group.id },
    });
    const memberIds = body.members.map((m) => m.studentProfileId);
    const students = await this.prisma.studentProfile.findMany({ where: { id: { in: memberIds } } });
    await this.prisma.chatMember.createMany({
      data: [
        { chatId: chat.id, userId: teacherId },
        ...students.map((s) => ({ chatId: chat.id, userId: s.userId })),
      ],
    });
    // grant course access if course set
    if (body.courseId) {
      for (const sid of memberIds) {
        await this.prisma.courseAccess.upsert({
          where: { courseId_studentId: { courseId: body.courseId, studentId: sid } },
          update: {},
          create: { courseId: body.courseId, studentId: sid },
        });
      }
    }
    return this.prisma.group.findUnique({
      where: { id: group.id },
      include: { members: { include: { student: { include: { user: true } } } }, chat: true, course: true },
    });
  }

  async one(teacherId: string, id: string) {
    const g = await this.prisma.group.findUnique({
      where: { id },
      include: {
        members: { include: { student: { include: { user: true } } } },
        course: true,
        chat: true,
        lessons: true,
      },
    });
    if (!g) throw new NotFoundException();
    if (g.teacherId !== teacherId) throw new ForbiddenException();
    return g;
  }

  async removeMember(teacherId: string, groupId: string, studentProfileId: string, keepCourseAccess: boolean) {
    const g = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!g || g.teacherId !== teacherId) throw new ForbiddenException();
    await this.prisma.groupMember.delete({
      where: { groupId_studentId: { groupId, studentId: studentProfileId } },
    });
    if (!keepCourseAccess && g.courseId) {
      await this.prisma.courseAccess.deleteMany({
        where: { courseId: g.courseId, studentId: studentProfileId },
      });
    }
    return { ok: true };
  }
}
