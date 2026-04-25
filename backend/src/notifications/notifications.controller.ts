import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get() list(@CurrentUser() u) { return this.svc.list(u.id); }
  @Post('read-all') readAll(@CurrentUser() u) { return this.svc.markAllRead(u.id); }
  @Post(':id/read') readOne(@CurrentUser() u, @Param('id') id: string) { return this.svc.markRead(u.id, id); }
}
