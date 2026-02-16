import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatService } from './chats.service';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../types/AuthenticatedSocket';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../auth/jwt-payload.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) { }

  /**
   * 클라이언트 연결 시 JWT를 검증하고, 유저를 개인 룸(user_${userId})에 입장시킵니다.
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) throw new UnauthorizedException();

      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.user = payload;

      // 개인 알림용 룸 입장
      const userRoom = `user_${payload.id}`;
      await client.join(userRoom);
      console.log(`User ${payload.id} connected and joined room ${userRoom}`);
    } catch (error) {
      console.error('WebSocket Connection Error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.user?.id;
    if (userId) {
      console.log(`User ${userId} disconnected`);
    }
  }

  /**
   * 특정 채팅방에 입장합니다.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: number,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user.id;
    const hasAccess = await this.chatService.isUserInRoom(userId, roomId);

    if (!hasAccess) {
      return { status: 'error', message: '접근 권한이 없습니다.' };
    }

    const roomName = `chat_room_${roomId}`;
    await client.join(roomName);
    return { status: 'success', roomId };
  }

  /**
   * 메시지를 전송합니다.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: number; content: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user.id;
    const hasAccess = await this.chatService.isUserInRoom(userId, data.roomId);

    if (!hasAccess) {
      return { status: 'error', message: '접근 권한이 없습니다.' };
    }

    const message = await this.chatService.createMessage(
      data.roomId,
      userId,
      data.content,
    );

    // 1. 현재 채팅방(Socket Room)에 조인된 사람들에게 실시간 메시지 전달
    this.server.to(`chat_room_${data.roomId}`).emit('newMessage', message);

    // 2. 방 참여자 전원의 '개인 알림 룸'으로 채팅 알림 발송 (방 목록 업데이트/푸시용)
    const participants = await this.chatService.getRoomParticipants(data.roomId);
    participants.forEach((p) => {
      if (p.userId !== userId) {
        this.emitNotification(p.userId, {
          id: Date.now(),
          type: 'NEW_CHAT',
          message: data.content,
          roomId: data.roomId,
          senderNickname: message.sender.nickname,
        });
      }
    });

    return message;
  }

  /**
   * 외부 서비스(NotificationsService 등)에서 알림을 보낼 때 사용하기 위한 도우미 메서드
   */
  emitNotification(userId: number, payload: any) {
    this.server.to(`user_${userId}`).emit('notification', payload);
  }
}
