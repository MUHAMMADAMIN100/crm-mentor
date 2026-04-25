import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private svc: StudentsService) {}

  @Roles('TEACHER')
  @Get()
  list(@CurrentUser() u) {
    return this.svc.listForTeacher(u.id);
  }

  @Roles('TEACHER')
  @Post()
  create(@CurrentUser() u, @Body() body: any) {
    return this.svc.createStudent(u.id, body);
  }

  @Roles('TEACHER')
  @Get(':id')
  one(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.getById(u.id, id);
  }

  @Roles('TEACHER')
  @Patch(':id')
  update(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateSettings(u.id, id, body);
  }

  @Roles('TEACHER')
  @Patch(':id/archive')
  archive(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.archive(u.id, id);
  }

  @Roles('STUDENT')
  @Get('me/dashboard')
  dashboard(@CurrentUser() u) {
    return this.svc.studentDashboard(u.id);
  }
}
