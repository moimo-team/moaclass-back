import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [PointsController],
  providers: [PointsService, PrismaService],
})
export class PointsModule {}
