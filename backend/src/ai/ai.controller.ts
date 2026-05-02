import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuditService } from '../admin/audit.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private ai: AiService, private audit: AuditService) {}

  @Get('suggestions')
  suggestions(@CurrentUser() u) {
    return { items: this.ai.suggestions(u.role) };
  }

  @Post('ask')
  async ask(@CurrentUser() u, @Body() body: { question: string; history?: any[] }) {
    const result = await this.ai.ask(u.id, body.question, body.history || []);
    // Log every AI query so admins can audit/trace what was asked.
    this.audit.log(u.id, 'ai.query', {
      meta: {
        role: u.role,
        question: (body.question || '').slice(0, 500),
        model: result?.model,
        // Don't store the full answer — it can be large/sensitive.
        answerSnippet: typeof result?.answer === 'string' ? result.answer.slice(0, 200) : '',
      },
    });
    return result;
  }
}
