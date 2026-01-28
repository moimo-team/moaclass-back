import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chats.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      id: number;
      email: string;
    };
  };
}
@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() meetingId: number,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(String(meetingId));
    return { status: 'joined', meetingId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { meetingId: number; content: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('client.data.user:', client.data.user);
    console.log('data:', data);

    const user = client.data.user; // Guard에서 저장한 유저 정보
    const isParticipant = await this.chatService.isUserInMeeting(
      user.id,
      data.meetingId,
    );
    if (!isParticipant) {
      return { authorized: false, message: '해당 모임에 참여하지 않았습니다.' };
    }

    const message = await this.chatService.createMessage(
      data.meetingId,
      user.id,
      data.content,
    );

    this.server.to(String(data.meetingId)).emit('newMessage', message);

    return message;
  }

  // 메시지 실시간 조회
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @MessageBody() meetingId: number,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const user = client.data.user;

    const isParticipant = await this.chatService.isUserInMeeting(
      user.id,
      meetingId,
    );
    if (!isParticipant) {
      return { authorized: false, message: '해당 모임에 참여하지 않았습니다.' };
    }

    const messages = await this.chatService.getMessages(meetingId);
    return { meetingId, messages };
  }
}
