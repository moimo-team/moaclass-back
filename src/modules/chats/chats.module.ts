import { Module } from '@nestjs/common';
import { ChatController } from './chats.controller';
import { ChatService } from './chats.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from './chats.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'yourSecretKey',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [ChatController], // REST API 엔드포인트
  providers: [
    ChatService, // DB 작업 및 비즈니스 로직
    ChatGateway, // WebSocket 실시간 처리
    PrismaService, // Prisma DB 연결
  ],
  exports: [ChatService], // 다른 모듈에서 ChatService 사용 가능
})
export class ChatsModule {}
