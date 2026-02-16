import { forwardRef, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ChatsModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }
