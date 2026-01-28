import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatService } from './chats.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 로그인한 사용자의 채팅방 목록 조회
  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  async getUserChatRooms(@Req() req: Request & { user?: { id: number } }) {
    if (!req.user) {
      return { authenticated: false };
    }
    return this.chatService.getUserChatRooms(req.user.id);
  }

  // 메시지 전송 (REST)
  @UseGuards(JwtAuthGuard)
  @Post(':meetingId/messages')
  async sendMessage(
    @Param('meetingId') meetingId: number,
    @Req() req: Request & { user?: { id: number } },
    @Body() body: { content: string },
  ) {
    if (!req.user) {
      return { authenticated: false };
    }

    return this.chatService.createMessage(
      meetingId,
      req.user.id, // senderId는 토큰에서 가져옴
      body.content,
    );
  }

  // 메시지 조회
  @UseGuards(JwtAuthGuard)
  @Get(':meetingId/messages')
  async getMessages(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user) {
      return { authenticated: false };
    }

    const isParticipant = await this.chatService.isUserInMeeting(
      req.user.id,
      meetingId,
    );
    if (!isParticipant) {
      return {
        authenticated: false,
        message: '해당 모임에 참여하지 않았습니다.',
      };
    }

    return this.chatService.getMessages(meetingId);
  }
}
