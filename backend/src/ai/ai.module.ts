import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [AiController],
  providers: [AiService, AiContextService],
})
export class AiModule {}
