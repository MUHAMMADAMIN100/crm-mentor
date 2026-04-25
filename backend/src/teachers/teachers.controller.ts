import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher')
export class TeachersController {
  constructor(private svc: TeachersService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() u) {
    return this.svc.dashboard(u.id);
  }

  @Patch('currency')
  currency(@CurrentUser() u, @Body() body: { currency: string }) {
    return this.svc.setCurrency(u.id, body.currency);
  }
}
