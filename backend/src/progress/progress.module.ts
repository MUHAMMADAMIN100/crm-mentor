import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { HomeworkModule } from '../homework/homework.module';
import { TreeModule } from '../tree/tree.module';

@Module({
  imports: [HomeworkModule, TreeModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
