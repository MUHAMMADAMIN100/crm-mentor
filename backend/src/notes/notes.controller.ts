import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private svc: NotesService) {}

  @Get() get(@CurrentUser() u) { return this.svc.get(u.id); }
  @Put() save(@CurrentUser() u, @Body() body: { body: string }) { return this.svc.save(u.id, body.body); }
}
