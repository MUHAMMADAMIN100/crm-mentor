import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private svc: ChatService) {}

  @Get() my(@CurrentUser() u) { return this.svc.myChats(u.id); }

  @Get('support') support(@CurrentUser() u) { return this.svc.ensureSupportChat(u.id); }

  @Post('private/:userId') open(@CurrentUser() u, @Param('userId') id: string) {
    return this.svc.getOrCreatePrivate(u.id, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() u, @Param('id') id: string) { return this.svc.getMessages(u.id, id); }

  @Post(':id/messages')
  send(@CurrentUser() u, @Param('id') id: string, @Body() body: any) {
    return this.svc.sendMessage(u.id, id, body);
  }
}
