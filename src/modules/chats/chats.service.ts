import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // 본인이 속한 채팅방 목록 + 마지막 메시지
  async getUserChatRooms(userId: number) {
    // 유저가 참여한 Meeting 목록 가져오기
    const participations = await this.prisma.participation.findMany({
      where: { userId, status: 'ACCEPTED' }, // 참여 승인된 모임만
      include: {
        meeting: {
          include: {
            host: true,
            participations: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: true },
            },
          },
        },
      },
    });

    // 필요한 데이터 형태로 가공
    return participations.map((p) => {
      const meeting = p.meeting;
      const lastMessage = meeting.messages[0];

      return {
        meetingId: meeting.id,
        title: meeting.title,
        image: meeting.image,
        hostId: meeting.hostId,
        lastMessage: lastMessage
          ? {
              sender: lastMessage.sender.nickname,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
            }
          : null,
        memberCount: meeting.participations.length,
        isLeader: meeting.hostId === userId,
      };
    });
  }

  async createMessage(meetingId: number, senderId: number, content: string) {
    return await this.prisma.chatMessage.create({
      data: {
        meetingId,
        senderId,
        content,
      },
      include: { sender: true },
    });
  }

  async getMessages(meetingId: number) {
    return this.prisma.chatMessage.findMany({
      where: { meetingId },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async isUserInMeeting(userId: number, meetingId: number): Promise<boolean> {
    const participation = await this.prisma.participation.findUnique({
      where: { userIdMeetingId: { userId, meetingId } },
    });
    return !!participation && participation.status === 'ACCEPTED';
  }
}
