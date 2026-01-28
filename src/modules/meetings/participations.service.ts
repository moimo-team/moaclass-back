import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParticipationStatus, NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class ParticipationsService {
  constructor(private prisma: PrismaService) {}

  async createParticipation(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        hostId: true,
        meetingDate: true,
        maxParticipants: true,
        currentParticipants: true,
        meetingDeleted: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임에는 신청할 수 없습니다.');
    }

    if (new Date(meeting.meetingDate) < new Date()) {
      throw new BadRequestException(
        '이미 기한이 지난 모임은 신청할 수 없습니다.',
      );
    }

    if (meeting.hostId === userId) {
      throw new BadRequestException(
        '호스트는 본인의 모임에 참여 신청을 할 수 없습니다.',
      );
    }

    if (meeting.currentParticipants >= meeting.maxParticipants) {
      throw new BadRequestException(
        `이미 정원이 꽉 찬 모임입니다. (최대 ${meeting.maxParticipants}명)`,
      );
    }

    const existingParticipation = await this.prisma.participation.findUnique({
      where: { userIdMeetingId: { userId, meetingId } },
    });

    if (existingParticipation) {
      throw new ConflictException('이미 참여 신청을 한 모임입니다.');
    }

    await this.prisma.$transaction([
      this.prisma.participation.create({
        data: { meetingId, userId, status: ParticipationStatus.PENDING },
      }),
      this.prisma.notification.create({
        data: {
          meetingId,
          receiverId: meeting.hostId,
          senderId: userId,
          type: NotificationType.PARTICIPATION_REQUEST,
        },
      }),
    ]);

    return;
  }

  async findApplicants(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { hostId: true, meetingDeleted: true },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임입니다.');
    }

    if (meeting.hostId !== userId) {
      throw new ForbiddenException(
        '호스트만 신청자 목록을 조회할 수 있습니다.',
      );
    }

    const participations = await this.prisma.participation.findMany({
      where: { meetingId, userId: { not: meeting.hostId } },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            bio: true,
            image: true,
            interests: {
              select: {
                interest: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return participations.map((p) => ({
      participationId: p.id,
      userId: p.user.id,
      nickname: p.user.nickname,
      bio: p.user.bio,
      profileImage: p.user.image,
      status: p.status,
      interests: p.user.interests.map((ui) => ({
        id: ui.interest.id,
        name: ui.interest.name,
      })),
    }));
  }

  async approveOne(
    meetingId: number,
    hostId: number,
    pId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트만 승인할 수 있습니다.');
      }

      if (meeting.currentParticipants >= meeting.maxParticipants) {
        throw new BadRequestException(
          `정원이 초과되었습니다. (최대 ${meeting.maxParticipants}명)`,
        );
      }

      const participation = await tx.participation.findUnique({
        where: { id: pId },
      });

      if (
        !participation ||
        participation.status !== ParticipationStatus.PENDING
      ) {
        throw new BadRequestException('승인 대기 중인 신청자가 아닙니다.');
      }

      await tx.participation.update({
        where: { id: pId },
        data: { status: ParticipationStatus.ACCEPTED },
      });

      await tx.meeting.update({
        where: { id: meetingId },
        data: { currentParticipants: { increment: 1 } },
      });

      await tx.notification.updateMany({
        where: {
          meetingId,
          receiverId: hostId,
          senderId: participation.userId,
          type: NotificationType.PARTICIPATION_REQUEST,
          isRead: false,
        },
        data: { isRead: true },
      });

      await tx.notification.create({
        data: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_ACCEPTED,
          isRead: false,
        },
      });

      return;
    });
  }

  async rejectOne(
    meetingId: number,
    hostId: number,
    pId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트만 거절할 수 있습니다.');
      }

      const participation = await tx.participation.findUnique({
        where: { id: pId },
      });

      if (
        !participation ||
        participation.status !== ParticipationStatus.PENDING
      ) {
        throw new BadRequestException('거절 가능한 신청 상태가 아닙니다.');
      }

      await tx.participation.update({
        where: { id: pId },
        data: { status: ParticipationStatus.REJECTED },
      });

      await tx.notification.updateMany({
        where: {
          meetingId,
          receiverId: hostId,
          senderId: participation.userId,
          type: NotificationType.PARTICIPATION_REQUEST,
          isRead: false,
        },
        data: { isRead: true },
      });

      await tx.notification.create({
        data: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_REJECTED,
          isRead: false,
        },
      });

      return;
    });
  }

  async approveAll(meetingId: number, hostId: number): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트 권한이 없습니다.');
      }

      const pendings = await tx.participation.findMany({
        where: {
          meetingId,
          status: ParticipationStatus.PENDING,
        },
      });

      if (pendings.length === 0) return;

      const remainingSlots =
        meeting.maxParticipants - meeting.currentParticipants;

      if (pendings.length > remainingSlots) {
        throw new BadRequestException(
          `남은 자리가 부족하여 모두 승인할 수 없습니다. (남은 자리: ${remainingSlots}명 / 대기 인원: ${pendings.length}명)`,
        );
      }

      await tx.participation.updateMany({
        where: {
          id: { in: pendings.map((p) => p.id) },
        },
        data: { status: ParticipationStatus.ACCEPTED },
      });

      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          currentParticipants: { increment: pendings.length },
        },
      });

      for (const p of pendings) {
        await tx.notification.updateMany({
          where: {
            meetingId,
            receiverId: hostId,
            senderId: p.userId,
            type: NotificationType.PARTICIPATION_REQUEST,
            isRead: false,
          },
          data: { isRead: true },
        });

        await tx.notification.create({
          data: {
            meetingId,
            receiverId: p.userId,
            senderId: hostId,
            type: NotificationType.PARTICIPATION_ACCEPTED,
            isRead: false,
          },
        });
      }
    });
  }

  async cancelApproval(
    meetingId: number,
    hostId: number,
    pId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트만 승인을 취소할 수 있습니다.');
      }

      const participation = await tx.participation.findUnique({
        where: { id: pId },
      });

      if (
        !participation ||
        participation.status !== ParticipationStatus.ACCEPTED
      ) {
        throw new BadRequestException('취소 가능한 승인 상태가 아닙니다.');
      }

      await tx.participation.update({
        where: { id: pId },
        data: { status: ParticipationStatus.PENDING },
      });

      await tx.meeting.update({
        where: { id: meetingId },
        data: { currentParticipants: { decrement: 1 } },
      });

      await tx.notification.deleteMany({
        where: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_ACCEPTED,
        },
      });

      await tx.notification.create({
        data: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_CANCELLED,
          isRead: false,
        },
      });

      await tx.notification.updateMany({
        where: {
          meetingId,
          receiverId: hostId,
          senderId: participation.userId,
          type: NotificationType.PARTICIPATION_REQUEST,
        },
        data: { isRead: false },
      });

      return;
    });
  }

  async cancelRejection(
    meetingId: number,
    hostId: number,
    pId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트만 거절을 취소할 수 있습니다.');
      }

      const participation = await tx.participation.findUnique({
        where: { id: pId },
      });

      if (
        !participation ||
        participation.status !== ParticipationStatus.REJECTED
      ) {
        throw new BadRequestException('취소 가능한 거절 상태가 아닙니다.');
      }

      await tx.participation.update({
        where: { id: pId },
        data: { status: ParticipationStatus.PENDING },
      });

      await tx.notification.deleteMany({
        where: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_REJECTED,
        },
      });

      await tx.notification.updateMany({
        where: {
          meetingId,
          receiverId: hostId,
          senderId: participation.userId,
          type: NotificationType.PARTICIPATION_REQUEST,
        },
        data: { isRead: false },
      });
    });
  }

  async getParticipants(meetingId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        host: {
          select: {
            id: true,
            nickname: true,
            bio: true,
            image: true,
          },
        },
        participations: {
          where: { status: ParticipationStatus.ACCEPTED },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                bio: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    const hostInfo = {
      userId: meeting.host.id,
      nickname: meeting.host.nickname,
      bio: meeting.host.bio || '',
      profileImage: meeting.host.image,
      isHost: true,
    };

    const participantsInfo = meeting.participations
      .filter((p) => p.user.id !== meeting.hostId)
      .map((p) => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        bio: p.user.bio || '',
        profileImage: p.user.image,
        isHost: false,
      }));

    return [hostInfo, ...participantsInfo];
  }
}
