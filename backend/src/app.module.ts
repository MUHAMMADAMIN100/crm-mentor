import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeachersModule } from './teachers/teachers.module';
import { StudentsModule } from './students/students.module';
import { CoursesModule } from './courses/courses.module';
import { GroupsModule } from './groups/groups.module';
import { CalendarModule } from './calendar/calendar.module';
import { FinanceModule } from './finance/finance.module';
import { HomeworkModule } from './homework/homework.module';
import { ProgressModule } from './progress/progress.module';
import { TreeModule } from './tree/tree.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotesModule } from './notes/notes.module';
import { AdminModule } from './admin/admin.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PublicModule } from './public/public.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    TeachersModule,
    StudentsModule,
    CoursesModule,
    GroupsModule,
    CalendarModule,
    FinanceModule,
    HomeworkModule,
    ProgressModule,
    TreeModule,
    ChatModule,
    NotificationsModule,
    NotesModule,
    AdminModule,
    SubscriptionModule,
    PublicModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
