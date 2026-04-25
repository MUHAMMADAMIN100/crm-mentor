import { Controller, Get, UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private svc: HomeworkService) {}

  @Roles('STUDENT') @Get('student')
  forStudent(@CurrentUser() u) { return this.svc.forStudent(u.id); }

  @Roles('TEACHER') @Get('teacher')
  forTeacher(@CurrentUser() u) { return this.svc.forTeacher(u.id); }
}
