import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, PrismaService],
  exports: [LessonsService], // 다른 모듈에서 사용할 수 있도록 export
})
export class LessonsModule {}
