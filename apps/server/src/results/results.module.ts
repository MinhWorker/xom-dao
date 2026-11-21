import { Module } from '@nestjs/common';
import { ResultsService } from './results.service.js';

@Module({
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
