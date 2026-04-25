import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private svc: CoursesService) {}

  // teacher
  @Roles('TEACHER') @Get() list(@CurrentUser() u) { return this.svc.listForTeacher(u.id); }
  @Roles('TEACHER') @Post() create(@CurrentUser() u, @Body() body: any) { return this.svc.create(u.id, body); }
  @Roles('TEACHER') @Get(':id') one(@CurrentUser() u, @Param('id') id: string) { return this.svc.getOne(u.id, id); }
  @Roles('TEACHER') @Patch(':id') update(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(u.id, id, body);
  }
  @Roles('TEACHER') @Delete(':id') del(@CurrentUser() u, @Param('id') id: string) { return this.svc.remove(u.id, id); }

  @Roles('TEACHER') @Post(':id/modules')
  createModule(@CurrentUser() u, @Param('id') id: string, @Body() body: { title: string }) {
    return this.svc.createModule(u.id, id, body.title);
  }

  @Roles('TEACHER') @Patch('modules/:mid')
  renameModule(@CurrentUser() u, @Param('mid') mid: string, @Body() body: { title: string }) {
    return this.svc.renameModule(u.id, mid, body.title);
  }

  @Roles('TEACHER') @Delete('modules/:mid')
  deleteModule(@CurrentUser() u, @Param('mid') mid: string) { return this.svc.deleteModule(u.id, mid); }

  @Roles('TEACHER') @Post('modules/:mid/lessons')
  createLesson(@CurrentUser() u, @Param('mid') mid: string, @Body() body: { title: string }) {
    return this.svc.createLesson(u.id, mid, body.title);
  }

  @Roles('TEACHER') @Patch('lessons/:lid')
  updateLesson(@CurrentUser() u, @Param('lid') lid: string, @Body() body: any) {
    return this.svc.updateLesson(u.id, lid, body);
  }

  @Roles('TEACHER') @Delete('lessons/:lid')
  deleteLesson(@CurrentUser() u, @Param('lid') lid: string) { return this.svc.deleteLesson(u.id, lid); }

  @Roles('TEACHER') @Post('lessons/:lid/blocks')
  addBlock(@CurrentUser() u, @Param('lid') lid: string, @Body() body: any) {
    return this.svc.addBlock(u.id, lid, body);
  }

  @Roles('TEACHER') @Patch('blocks/:bid')
  updateBlock(@CurrentUser() u, @Param('bid') bid: string, @Body() body: any) {
    return this.svc.updateBlock(u.id, bid, body);
  }

  @Roles('TEACHER') @Delete('blocks/:bid')
  deleteBlock(@CurrentUser() u, @Param('bid') bid: string) { return this.svc.deleteBlock(u.id, bid); }

  @Roles('TEACHER') @Post(':id/access')
  grantAccess(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.grantAccess(u.id, id, body);
  }

  @Roles('TEACHER') @Delete(':id/access/:sid')
  revokeAccess(@CurrentUser() u, @Param('id') id: string, @Param('sid') sid: string) {
    return this.svc.revokeAccess(u.id, id, sid);
  }

  // student
  @Roles('STUDENT') @Get('me/list')
  myList(@CurrentUser() u) { return this.svc.listForStudent(u.id); }

  @Roles('STUDENT') @Get('me/:id')
  myOne(@CurrentUser() u, @Param('id') id: string) { return this.svc.getCourseForStudent(u.id, id); }
}
