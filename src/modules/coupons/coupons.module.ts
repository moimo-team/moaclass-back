import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsScheduler } from './coupons.scheduler';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService, PrismaService, CouponsScheduler],
  exports: [CouponsService],
})
export class CouponsModule { }
