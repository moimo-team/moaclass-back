import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from '../notification/notifications.module';
import { MailsModule } from '../mails/mails.module';

import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [NotificationsModule, MailsModule, CouponsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, PrismaService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule { }
