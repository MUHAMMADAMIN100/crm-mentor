import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('subscription')
export class SubscriptionController {
  constructor(private svc: SubscriptionService) {}

  @Get('me') me(@CurrentUser() u) { return this.svc.get(u.id); }
}
