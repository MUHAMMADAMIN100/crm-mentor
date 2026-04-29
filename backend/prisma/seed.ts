import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEACHERS = [
  { login: 'teacher',   name: 'Анна Иванова',     email: 'anna@miz.local',     subject: 'Английский язык', currency: 'RUB', amount: 1990 },
  { login: 'teacher2',  name: 'Пётр Сидоров',     email: 'petr.s@miz.local',   subject: 'Математика',      currency: 'RUB', amount: 1990 },
  { login: 'teacher3',  name: 'Мария Кузнецова',  email: 'maria@miz.local',    subject: 'Физика',          currency: 'RUB', amount: 1990 },
  { login: 'teacher4',  name: 'Алексей Соколов',  email: 'alex@miz.local',     subject: 'Химия',           currency: 'KZT', amount: 12000 },
  { login: 'teacher5',  name: 'Елена Морозова',   email: 'elena@miz.local',    subject: 'Биология',        currency: 'RUB', amount: 1990 },
  { login: 'teacher6',  name: 'Дмитрий Волков',   email: 'dmitry@miz.local',   subject: 'История',         currency: 'USD', amount: 25 },
  { login: 'teacher7',  name: 'Ольга Никитина',   email: 'olga@miz.local',     subject: 'Информатика',     currency: 'EUR', amount: 22 },
  { login: 'teacher8',  name: 'Сергей Лебедев',   email: 'sergey@miz.local',   subject: 'Литература',      currency: 'RUB', amount: 1990 },
  { login: 'teacher9',  name: 'Татьяна Орлова',   email: 'tatyana@miz.local',  subject: 'Музыка',          currency: 'UZS', amount: 250000 },
  { login: 'teacher10', name: 'Игорь Васильев',   email: 'igor@miz.local',     subject: 'Рисование',       currency: 'RUB', amount: 1990 },
];

const STUDENTS = [
  { login: 'student',   name: 'Пётр Смирнов',     email: 'petr@miz.local',     goal: 'Подготовка к экзамену',         price: 1500,   balance: 3000 },
  { login: 'student2',  name: 'Анастасия Попова', email: 'nastya@miz.local',   goal: 'Подтянуть алгебру',             price: 1800,   balance: 5400 },
  { login: 'student3',  name: 'Кирилл Зайцев',    email: 'kirill@miz.local',   goal: 'Олимпиадный уровень по физике', price: 2200,   balance: 4400 },
  { login: 'student4',  name: 'Ксения Михайлова', email: 'ksenia@miz.local',   goal: 'Поступить на медфак',           price: 9000,   balance: 18000 },
  { login: 'student5',  name: 'Артём Степанов',   email: 'artem@miz.local',    goal: 'Школьная программа 10 класс',   price: 1500,   balance: 1500 },
  { login: 'student6',  name: 'Виктория Белова',  email: 'vika@miz.local',     goal: 'История России для ОГЭ',        price: 30,     balance: 90 },
  { login: 'student7',  name: 'Никита Ковалёв',   email: 'nikita@miz.local',   goal: 'Программирование на Python',    price: 25,     balance: 75 },
  { login: 'student8',  name: 'Юлия Гордеева',    email: 'yulia@miz.local',    goal: 'Сочинения и анализ текста',     price: 1700,   balance: 3400 },
  { login: 'student9',  name: 'Глеб Романов',     email: 'gleb@miz.local',     goal: 'Уроки фортепиано',              price: 200000, balance: 600000 },
  { login: 'student10', name: 'Полина Жукова',    email: 'polina@miz.local',   goal: 'Развитие навыков рисования',    price: 1800,   balance: 3600 },
];

const COURSES = [
  { title: 'Английский с нуля',          category: 'Английский язык', price: 9900,   desc: 'Базовый курс грамматики и лексики.' },
  { title: 'Математика 9 класс',         category: 'Математика',      price: 7900,   desc: 'Подготовка к ОГЭ: алгебра и геометрия.' },
  { title: 'Физика: механика',           category: 'Физика',          price: 8500,   desc: 'Кинематика, динамика, законы Ньютона.' },
  { title: 'Органическая химия',         category: 'Химия',           price: 12000,  desc: 'Углеводороды, ароматика, биомолекулы.' },
  { title: 'Биология ЕГЭ',               category: 'Биология',        price: 9500,   desc: 'Клетка, генетика, эволюция, экология.' },
  { title: 'История России XX век',      category: 'История',         price: 50,     desc: 'Революция, СССР, перестройка.' },
  { title: 'Python для начинающих',      category: 'Информатика',     price: 80,     desc: 'Синтаксис, структуры данных, ООП.' },
  { title: 'Русская литература',         category: 'Литература',      price: 7500,   desc: 'Классика XIX-XX века с анализом.' },
  { title: 'Фортепиано: с нуля до этюдов', category: 'Музыка',        price: 800000, desc: 'Постановка рук, сольфеджио, репертуар.' },
  { title: 'Графика и композиция',       category: 'Рисование',       price: 6500,   desc: 'Линия, тон, перспектива, портрет.' },
];

const WELCOME_MESSAGES = [
  'Привет! Рад(а) приветствовать тебя на курсе. Если будут вопросы — пиши сюда.',
  'Здравствуйте! Я ваш ментор. Жду ваших первых работ — присылайте в любое время.',
  'Привет! Если что-то непонятно — не стесняйся писать, разберём вместе.',
  'Добро пожаловать! Здесь мы будем обсуждать домашние задания и планы.',
  'Привет! Я на связи в будние дни с 10 до 19. Пиши когда удобно.',
];

async function main() {
  const adminPwd = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
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

  const teacherPwd = await bcrypt.hash('teacher123', 10);
  const teacherUsers: any[] = [];
  for (const t of TEACHERS) {
    const u = await prisma.user.upsert({
      where: { login: t.login },
      update: { teacherCurrency: t.currency },
      create: {
        login: t.login,
        password: teacherPwd,
        role: 'TEACHER',
        fullName: t.name,
        email: t.email,
        category: t.subject,
        profileCompleted: true,
        mustChangePassword: false,
        teacherCurrency: t.currency,
        teacherSubscription: {
          create: {
            status: 'ACTIVE',
            type: 'MONTH',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 86400000),
            amount: t.amount,
          },
        },
      },
    });
    teacherUsers.push(u);
  }

  const studentPwd = await bcrypt.hash('student123', 10);
  const studentUsers: any[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const teacherUser = teacherUsers[i];
    const u: any = await prisma.user.upsert({
      where: { login: s.login },
      update: {},
      create: {
        login: s.login,
        password: studentPwd,
        role: 'STUDENT',
        fullName: s.name,
        email: s.email,
        goal: s.goal,
        profileCompleted: true,
        mustChangePassword: false,
        studentProfile: {
          create: {
            teacherId: teacherUser.id,
            individualPrice: s.price,
            balance: s.balance,
            allowReschedule: true,
            tree: { create: { completedCount: 0, level: 0 } },
          },
        },
      },
      include: { studentProfile: true },
    });
    if (!u.studentProfile) {
      const created = await prisma.studentProfile.upsert({
        where: { userId: u.id },
        update: { teacherId: teacherUser.id },
        create: {
          userId: u.id,
          teacherId: teacherUser.id,
          individualPrice: s.price,
          balance: s.balance,
          allowReschedule: true,
          tree: { create: { completedCount: 0, level: 0 } },
        },
      });
      u.studentProfile = created;
    }
    studentUsers.push(u);
  }

  for (let i = 0; i < COURSES.length; i++) {
    const teacherUser = teacherUsers[i];
    const studentUser = studentUsers[i];
    const c = COURSES[i];

    const existing = await prisma.course.findFirst({
      where: { teacherId: teacherUser.id, title: c.title },
    });
    let course = existing;
    if (!course) {
      course = await prisma.course.create({
        data: {
          teacherId: teacherUser.id,
          title: c.title,
          description: c.desc,
          category: c.category,
          price: c.price,
          status: 'PUBLISHED_PRIVATE',
          modules: {
            create: [
              {
                title: 'Модуль 1. Введение',
                position: 0,
                lessons: {
                  create: [
                    {
                      title: 'Урок 1. Знакомство с темой',
                      position: 0,
                      isHomework: true,
                      blocks: {
                        create: [
                          { type: 'TEXT', position: 0, textTitle: 'Введение', textBody: `Добро пожаловать на курс «${c.title}». Сегодня мы начинаем путь.` },
                        ],
                      },
                    },
                    {
                      title: 'Урок 2. Первая практика',
                      position: 1,
                      isHomework: true,
                      blocks: {
                        create: [
                          { type: 'TEXT', position: 0, textTitle: 'Практика', textBody: 'Выполните практическое задание ниже.' },
                          { type: 'WRITTEN', position: 1, writtenPrompt: 'Опишите своими словами, что вы поняли из первого урока.', isHomework: true },
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
    }

    if (studentUser.studentProfile) {
      await prisma.courseAccess.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: studentUser.studentProfile.id } },
        update: {},
        create: { courseId: course.id, studentId: studentUser.studentProfile.id },
      });
    }
  }

  for (let i = 0; i < teacherUsers.length; i++) {
    const teacherUser = teacherUsers[i];
    const studentUser = studentUsers[i];
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId: teacherUser.id } } },
          { members: { some: { userId: studentUser.id } } },
        ],
      },
    });
    if (!existing) {
      const chat = await prisma.chat.create({
        data: {
          type: 'PRIVATE',
          members: { create: [{ userId: teacherUser.id }, { userId: studentUser.id }] },
        },
      });
      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: teacherUser.id,
          kind: 'TEXT',
          text: WELCOME_MESSAGES[i % WELCOME_MESSAGES.length],
        },
      });
    }
  }

  console.log('Seed OK:');
  console.log('  admin    / admin123');
  console.log(`  ${TEACHERS.length} teachers (login: teacher, teacher2..teacher${TEACHERS.length}) / teacher123`);
  console.log(`  ${STUDENTS.length} students (login: student, student2..student${STUDENTS.length}) / student123`);
  console.log(`  ${COURSES.length} courses + ${teacherUsers.length} private chats`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
