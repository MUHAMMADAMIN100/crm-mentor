import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private svc: PublicService) {}

  @Get('teachers/:id/slots')
  list(@Param('id') id: string) { return this.svc.listFreeSlotsForTeacher(id); }

  @Post('slots/:slug/book')
  book(@Param('slug') slug: string, @Body() body: { name: string; contact: string }) {
    return this.svc.bookSlot(slug, body);
  }
}
