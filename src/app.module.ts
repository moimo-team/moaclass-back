import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { InterestsModule } from './modules/interests/interests.module';
import { ChatsModule } from './modules/chats/chats.module';
import { NotificationsModule } from './modules/notification/notifications.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    MeetingsModule,
    AuthModule,
    InterestsModule,
    ChatsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
