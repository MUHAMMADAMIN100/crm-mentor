import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private svc: CalendarService) {}

  @Roles('TEACHER') @Get() teacher(@CurrentUser() u, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.teacherCalendar(u.id, from, to);
  }
  @Roles('TEACHER') @Post('lessons') createLesson(@CurrentUser() u, @Body() b: any) { return this.svc.createLesson(u.id, b); }
  @Roles('TEACHER') @Patch('lessons/:id') updateLesson(@CurrentUser() u, @Param('id') id: string, @Body() b: any) {
    return this.svc.updateLesson(u.id, id, b);
  }
  @Roles('TEACHER') @Post('lessons/:id/complete')
  completeLesson(@CurrentUser() u, @Param('id') id: string) { return this.svc.completeLesson(u.id, id); }
  @Roles('TEACHER') @Delete('lessons/:id') deleteLesson(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.deleteLesson(u.id, id);
  }

  @Roles('TEACHER') @Post('free-slots') createFreeSlot(@CurrentUser() u, @Body() b: any) {
    return this.svc.createFreeSlot(u.id, b);
  }
  @Roles('TEACHER') @Patch('free-slots/:id') updateFreeSlot(@CurrentUser() u, @Param('id') id: string, @Body() b: any) {
    return this.svc.updateFreeSlot(u.id, id, b);
  }
  @Roles('TEACHER') @Delete('free-slots/:id') deleteFreeSlot(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.deleteFreeSlot(u.id, id);
  }

  @Post('events') createEvent(@CurrentUser() u, @Body() b: any) { return this.svc.createEvent(u.id, b); }
  @Patch('events/:id') updateEvent(@CurrentUser() u, @Param('id') id: string, @Body() b: any) {
    return this.svc.updateEvent(u.id, id, b);
  }
  @Delete('events/:id') deleteEvent(@CurrentUser() u, @Param('id') id: string) { return this.svc.deleteEvent(u.id, id); }

  @Roles('STUDENT') @Get('student') student(@CurrentUser() u, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.studentCalendar(u.id, from, to);
  }
  @Roles('STUDENT') @Post('student/reschedule')
  reschedule(@CurrentUser() u, @Body() b: { lessonId: string; freeSlotId: string }) {
    return this.svc.rescheduleByStudent(u.id, b.lessonId, b.freeSlotId);
  }
}
