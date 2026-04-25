import { Controller, Get, UseGuards } from '@nestjs/common';
import { TreeService } from './tree.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tree')
export class TreeController {
  constructor(private svc: TreeService) {}

  @Roles('STUDENT') @Get('me')
  me(@CurrentUser() u) { return this.svc.getForStudent(u.id); }

  @Roles('TEACHER') @Get('garden')
  garden(@CurrentUser() u) { return this.svc.garden(u.id); }
}
