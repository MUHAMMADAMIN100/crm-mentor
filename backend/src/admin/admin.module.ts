import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ManagersService } from './managers.service';
import { SystemService } from './system.service';
import { AuditService } from './audit.service';
import { AdminMailService } from './admin-mail.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, ManagersService, SystemService, AuditService, AdminMailService],
  exports: [AuditService],
})
export class AdminModule {}
