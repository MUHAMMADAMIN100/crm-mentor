import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('suggestions')
  suggestions(@CurrentUser() u) {
    return { items: this.ai.suggestions(u.role) };
  }

  @Post('ask')
  ask(@CurrentUser() u, @Body() body: { question: string; history?: any[] }) {
    return this.ai.ask(u.id, body.question, body.history || []);
  }
}
