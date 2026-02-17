import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParticipationStatus } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) { }

  /**
   * 해당 도메인(Meeting/Lesson)에 대한 채팅방을 가져오거나 새로 생성합니다.
   * - Meeting: 모임별로 하나의 단체 채팅방이 존재합니다.
   * - Lesson: (레슨 + 학생)별로 각각의 1:1 문의 채팅방이 존재합니다.
   */
  async getOrCreateRoom(userId: number, target: { meetingId?: number; lessonId?: number; studentId?: number }) {
    const { meetingId, lessonId } = target;
    let studentId = target.studentId;

    // 레슨 문의의 경우, 요청자가 학생일 때 본인 ID를 studentId로 사용
    if (lessonId && !studentId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { userId: true },
      });
      if (lesson && lesson.userId !== userId) {
        studentId = userId; // 요청자가 강사가 아니라면 학생 본인으로 간주
      }
    }

    // 1. 기존 방 조회
    let room = await this.prisma.chatRoom.findFirst({
      where: {
        AND: [
          meetingId ? { meetingId } : { meetingId: null },
          lessonId ? { lessonId } : { lessonId: null },
          studentId ? { studentId } : { studentId: null },
        ],
      },
    });

    // 2. 방이 없으면 생성
    if (!room) {
      room = await this.prisma.chatRoom.create({
        data: {
          meetingId,
          lessonId,
          studentId,
        },
      });

      // 강사/호스트 자동 추가 로직
      if (lessonId) {
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: lessonId },
          select: { userId: true },
        });
        if (lesson) {
          await this.prisma.chatParticipant.upsert({
            where: { roomId_userId: { roomId: room.id, userId: lesson.userId } },
            update: {},
            create: { roomId: room.id, userId: lesson.userId },
          });
        }
      }

      if (meetingId) {
        const meeting = await this.prisma.meeting.findUnique({
          where: { id: meetingId },
          select: { hostId: true },
        });
        if (meeting) {
          await this.prisma.chatParticipant.upsert({
            where: { roomId_userId: { roomId: room.id, userId: meeting.hostId } },
            update: {},
            create: { roomId: room.id, userId: meeting.hostId },
          });
        }
      }
    }

    // 3. 요청한 유저를 참여자로 추가 (권한 확인 후)
    const hasAccess = await this.hasDomainAccess(userId, { meetingId, lessonId, studentId });
    if (!hasAccess) {
      throw new ForbiddenException('해당 채팅방에 참여할 권한이 없습니다.');
    }

    await this.prisma.chatParticipant.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: {},
      create: { roomId: room.id, userId },
    });

    return room;
  }

  /**
   * 유저가 원천 도메인에 대한 접근 권한이 있는지 확인
   */
  private async hasDomainAccess(userId: number, target: { meetingId?: number; lessonId?: number; studentId?: number }): Promise<boolean> {
    if (target.meetingId) {
      const participation = await this.prisma.participation.findUnique({
        where: { userId_meetingId: { userId, meetingId: target.meetingId } },
      });
      return participation?.status === ParticipationStatus.ACCEPTED;
    }

    if (target.lessonId) {
      // 강사인지 확인
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: target.lessonId },
        select: { userId: true },
      });
      if (lesson?.userId === userId) return true;

      // 1:1 문의방의 경우, 해당 studentId인 유저만 접근 가능
      if (target.studentId && target.studentId !== userId) {
        return false;
      }

      // 수강생 권한 체크 (문의는 수강 전에도 가능할 수 있으므로, 비즈니스 정책에 따라 조정 가능)
      // 여기서는 최소한 '가입된 유저'면 문의 가능하도록 하거나, 결제 내역 확인
      return true;
    }

    return false;
  }

  async isUserInRoom(userId: number, roomId: number): Promise<boolean> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    return !!participant;
  }

  async createMessage(roomId: number, senderId: number, content: string) {
    return await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: { id: true, nickname: true, image: true },
        },
      },
    });
  }

  async getMessages(roomId: number) {
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      include: {
        sender: {
          select: { id: true, nickname: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMyChatRooms(userId: number) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            meeting: true,
            lesson: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return participants.map((p) => ({
      roomId: p.room.id,
      meetingId: p.room.meetingId,
      lessonId: p.room.lessonId,
      title: p.room.meeting?.title || p.room.lesson?.title,
      lastMessage: p.room.messages[0]?.content || null,
      updatedAt: p.room.updatedAt,
    }));
  }

  async getRoomParticipants(roomId: number) {
    return this.prisma.chatParticipant.findMany({
      where: { roomId },
      select: { userId: true },
    });
  }
}
