import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ManagersService } from './managers.service';
import { SystemService } from './system.service';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private svc: AdminService,
    private managers: ManagersService,
    private system: SystemService,
    private audit: AuditService,
  ) {}

  // ----- Teachers -----
  @Get('teachers') teachers(@Query() q: any) {
    return this.svc.listTeachers({
      search: q.search, status: q.status, archived: q.archived, sort: q.sort,
      activity: q.activity, hasStudents: q.hasStudents, hasCourses: q.hasCourses,
      limit: q.limit, offset: q.offset,
    });
  }
  @Post('teachers') createTeacher(@CurrentUser() u, @Body() body: any) { return this.svc.createTeacher(u.id, body); }
  @Get('teachers/:id') teacherCard(@Param('id') id: string) { return this.svc.getTeacherCard(id); }
  @Patch('teachers/:id') editTeacher(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateTeacher(u.id, id, body);
  }

  // ----- Subscriptions -----
  @Patch('teachers/:id/subscription')
  updateSub(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateSubscription(u.id, id, body);
  }
  @Post('teachers/:id/subscription/extend')
  extendSub(@CurrentUser() u, @Param('id') id: string, @Body() body: { months: number; amount?: number; comment?: string }) {
    return this.svc.extendSubscription(u.id, id, +body.months, body.amount, body.comment);
  }
  @Patch('teachers/:id/subscription/status')
  setSubStatus(@CurrentUser() u, @Param('id') id: string, @Body() body: { status: any; comment?: string }) {
    return this.svc.setSubscriptionStatus(u.id, id, body.status, body.comment);
  }

  // ----- Users (archive / unarchive / delete) -----
  @Patch('users/:id/archive') archive(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.archiveUser(u.id, id, body?.reason);
  }
  @Patch('users/:id/unarchive') unarchive(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.unarchiveUser(u.id, id);
  }
  @Delete('users/:id') del(@CurrentUser() u, @Param('id') id: string, @Query('reason') reason?: string) {
    return this.svc.deleteUser(u.id, id, reason);
  }
  @Post('users/bulk-archive') bulkArchive(@CurrentUser() u, @Body() body: { ids: string[]; reason?: string }) {
    return this.svc.bulkArchive(u.id, body.ids || [], body.reason);
  }

  // ----- Students -----
  @Get('students') students(@Query() q: any) {
    return this.svc.listStudents({
      search: q.search, archived: q.archived, teacherId: q.teacherId, tag: q.tag,
      sort: q.sort, activity: q.activity, limit: q.limit, offset: q.offset,
    });
  }
  @Get('students/:id') studentCard(@Param('id') id: string) { return this.svc.getStudentCard(id); }
  @Patch('students/:id/transfer') transferStudent(@CurrentUser() u, @Param('id') id: string, @Body() body: { newTeacherId: string }) {
    return this.svc.transferStudent(u.id, id, body.newTeacherId);
  }
  @Patch('students/:id/tags') setStudentTags(@CurrentUser() u, @Param('id') id: string, @Body() body: { tags: string }) {
    return this.svc.setStudentTags(u.id, id, body.tags || '');
  }

  // ----- Courses -----
  @Get('courses') courses(@Query() q: any) {
    return this.svc.listCourses({ search: q.search, status: q.status, teacherId: q.teacherId });
  }
  @Get('courses/:id') courseCard(@Param('id') id: string) { return this.svc.getCourseCard(id); }
  @Patch('courses/:id/status') setCourseStatus(@CurrentUser() u, @Param('id') id: string, @Body() body: { status: any }) {
    return this.svc.setCourseStatus(u.id, id, body.status);
  }

  // ----- Finance / Analytics / Dashboard -----
  @Get('finance') finance(@Query() q: any) {
    return this.svc.finance({ search: q.search, status: q.status, period: q.period });
  }
  @Get('analytics') analytics(@Query() q: any) { return this.svc.analytics({ period: q.period }); }
  @Get('dashboard') dashboard() { return this.svc.dashboard(); }

  // ----- Managers -----
  @Get('managers') listManagers() { return this.managers.list(); }
  @Get('managers/permissions') permCatalog() { return this.managers.permissionsCatalog(); }
  @Post('managers') createManager(@CurrentUser() u, @Body() body: any) { return this.managers.create(u.id, body); }
  @Patch('managers/:id') updateManager(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.managers.update(u.id, id, body);
  }
  @Get('managers/:id/stats') managerStats(@Param('id') id: string) { return this.managers.stats(id); }

  // ----- System / settings / templates -----
  @Get('system/settings') getSettings() { return this.system.getAllSettings(); }
  @Patch('system/settings') updateSettings(@CurrentUser() u, @Body() body: Record<string, string>) {
    return this.system.setSettings(u.id, body);
  }
  @Get('system/templates') listTemplates() { return this.system.listTemplates(); }
  @Patch('system/templates/:id') updateTemplate(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.system.updateTemplate(u.id, id, body);
  }

  // ----- Audit log -----
  @Get('audit') auditList(@Query() q: any) {
    return this.audit.list(+(q.limit || 100), +(q.offset || 0), { actorId: q.actorId, action: q.action, targetId: q.targetId });
  }
  @Get('audit/count') auditCount(@Query() q: any) {
    return this.audit.count({ actorId: q.actorId, action: q.action }).then((count) => ({ count }));
  }
}
