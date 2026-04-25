import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('teachers') teachers() { return this.svc.listTeachers(); }
  @Post('teachers') createTeacher(@Body() body: any) { return this.svc.createTeacher(body); }

  @Patch('teachers/:id/subscription')
  updateSub(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateSubscription(id, body);
  }

  @Patch('users/:id/archive') archive(@Param('id') id: string) { return this.svc.archiveUser(id); }
  @Patch('users/:id/unarchive') unarchive(@Param('id') id: string) { return this.svc.unarchiveUser(id); }
  @Delete('users/:id') del(@Param('id') id: string) { return this.svc.deleteUser(id); }

  @Get('students') students() { return this.svc.listStudents(); }
  @Get('courses') courses() { return this.svc.listCourses(); }
  @Get('finance') finance() { return this.svc.finance(); }
  @Get('analytics') analytics() { return this.svc.analytics(); }
}
