import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';

import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [CouponsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
})
export class PaymentsModule { }
