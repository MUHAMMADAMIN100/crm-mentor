import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPwd = await bcrypt.hash('admin123', 10);
  const teacherPwd = await bcrypt.hash('teacher123', 10);
  const studentPwd = await bcrypt.hash('student123', 10);

  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      password: adminPwd,
      role: 'ADMIN',
      fullName: 'Администратор Miz',
      email: 'admin@miz.local',
      profileCompleted: true,
      mustChangePassword: false,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { login: 'teacher' },
    update: {},
    create: {
      login: 'teacher',
      password: teacherPwd,
      role: 'TEACHER',
      fullName: 'Анна Иванова',
      email: 'anna@miz.local',
      profileCompleted: true,
      mustChangePassword: false,
      teacherCurrency: 'RUB',
      teacherSubscription: {
        create: {
          status: 'ACTIVE',
          type: 'MONTH',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          amount: 1990,
        },
      },
    },
  });

  const student = await prisma.user.upsert({
    where: { login: 'student' },
    update: {},
    create: {
      login: 'student',
      password: studentPwd,
      role: 'STUDENT',
      fullName: 'Пётр Смирнов',
      email: 'petr@miz.local',
      profileCompleted: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          teacherId: teacher.id,
          individualPrice: 1500,
          balance: 3000,
          allowReschedule: true,
          tree: { create: { completedCount: 0, level: 0 } },
        },
      },
    },
    include: { studentProfile: true },
  });

  // Demo course
  const course = await prisma.course.create({
    data: {
      teacherId: teacher.id,
      title: 'Английский с нуля',
      description: 'Базовый курс грамматики и лексики',
      category: 'Английский язык',
      price: 9900,
      status: 'PUBLISHED_PRIVATE',
      modules: {
        create: [
          {
            title: 'Модуль 1. Знакомство',
            position: 0,
            lessons: {
              create: [
                {
                  title: 'Урок 1. Привет, английский!',
                  position: 0,
                  isHomework: true,
                  blocks: {
                    create: [
                      { type: 'TEXT', position: 0, textTitle: 'Введение', textBody: 'Английский — лингва франка...' },
                      { type: 'VIDEO', position: 1, videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'], isHomework: true },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  if (student.studentProfile) {
    await prisma.courseAccess.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.studentProfile.id } },
      update: {},
      create: { courseId: course.id, studentId: student.studentProfile.id },
    });
  }

  console.log('Seed OK:');
  console.log('  admin   / admin123');
  console.log('  teacher / teacher123');
  console.log('  student / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
