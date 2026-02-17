import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ChatService } from './chats.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../types/AuthenticatedRequest';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  /**
   * 참여 중인 채팅방 목록 조회
   */
  @Get('rooms/me')
  async getMyChatRooms(@Req() req: Request & { user: JwtPayload }) {
    return this.chatService.getMyChatRooms(req.user.id);
  }

  /**
   * 특정 도메인(미팅/레슨)에 대한 채팅방 입장 및 권한 확인
   * 방이 없으면 생성하고, 유저를 참여자로 등록합니다.
   */
  @Post('rooms/join')
  async joinOrCreateRoom(
    @Req() req: AuthenticatedRequest,
    @Body() body: { meetingId?: number; lessonId?: number; studentId?: number },
  ) {
    return this.chatService.getOrCreateRoom(req.user.id, body);
  }

  /**
   * 특정 채팅방의 메시지 내역 조회
   */
  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const hasAccess = await this.chatService.isUserInRoom(req.user.id, roomId);
    if (!hasAccess) {
      throw new ForbiddenException('해당 채팅방에 접근 권한이 없습니다.');
    }

    return this.chatService.getMessages(roomId);
  }
}
