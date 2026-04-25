import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
@Controller('progress')
export class ProgressController {
  constructor(private svc: ProgressService) {}

  @Post('blocks/:bid/done')
  done(@CurrentUser() u, @Param('bid') bid: string, @Body() body: any) {
    return this.svc.markBlockDone(u.id, bid, body?.data);
  }

  @Post('blocks/:bid/quiz')
  quiz(@CurrentUser() u, @Param('bid') bid: string, @Body() body: { answers: any }) {
    return this.svc.submitQuiz(u.id, bid, body.answers);
  }

  @Get('me')
  me(@CurrentUser() u) { return this.svc.myProgress(u.id); }
}
