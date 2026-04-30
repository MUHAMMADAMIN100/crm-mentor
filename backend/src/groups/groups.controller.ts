import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('groups')
export class GroupsController {
  constructor(private svc: GroupsService) {}

  @Get() list(@CurrentUser() u) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u, @Body() body: any) { return this.svc.create(u.id, body); }
  @Get(':id') one(@CurrentUser() u, @Param('id') id: string) { return this.svc.one(u.id, id); }
  @Patch(':id') update(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(u.id, id, body);
  }
  @Delete(':id') remove(@CurrentUser() u, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }

  @Delete(':id/members/:sid')
  removeMember(
    @CurrentUser() u,
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Query('keepCourseAccess') keep: string,
  ) {
    return this.svc.removeMember(u.id, id, sid, keep === 'true');
  }
}
