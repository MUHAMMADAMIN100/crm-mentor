import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private svc: FinanceService) {}

  @Roles('TEACHER') @Get('teacher')
  teacher(@CurrentUser() u) { return this.svc.teacherSummary(u.id); }

  @Roles('TEACHER') @Post('teacher/students/:id/topup')
  topup(@CurrentUser() u, @Param('id') id: string, @Body() b: any) {
    return this.svc.addPayment(u.id, id, b);
  }

  @Roles('STUDENT') @Get('student/balance')
  studentBalance(@CurrentUser() u) { return this.svc.studentBalance(u.id); }
}
