import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NotificationItemDto } from './dto/notification-item.dto';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';
import { ChatGateway } from '../chats/chats.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) { }

  /**
   * 알림을 생성하고 해당 유저에게 실시간으로 전송합니다.
   */
  async createNotification(data: {
    receiverId: number;
    senderId?: number;
    type: string;
    meetingId?: number;
    lessonId?: number;
    roomId?: number;
  }) {
    const notification = await this.prisma.notification.create({
      data: data as any,
      include: {
        meeting: true,
        lesson: true,
        room: true,
      },
    });

    // 실시간 웹소켓 전송
    this.chatGateway.emitNotification(notification.receiverId, {
      id: notification.id,
      type: notification.type,
      message: this.getNotificationMessage(notification),
      linkId: notification.meetingId || notification.lessonId,
      linkType: notification.meetingId ? 'MEETING' : 'LESSON',
      roomId: notification.roomId,
    });

    return notification;
  }

  private getNotificationMessage(notification: any): string {
    switch (notification.type) {
      case 'PARTICIPATION_REQUEST':
        return '새로운 참여 신청이 있습니다.';
      case 'PARTICIPATION_ACCEPTED':
        return '참여 신청이 승인되었습니다!';
      case 'NEW_CHAT':
        return '새로운 채팅 메시지가 있습니다.';
      default:
        return '새로운 알림이 도착했습니다.';
    }
  }

  /**
   * 알림 목록 조회 (페이징 지원)
   */
  async getNotifications(
    userId: number,
    pageOptionsDto: GetNotificationsDto,
  ): Promise<PageDto<NotificationItemDto>> {
    const { page = 1, limit = 10 } = pageOptionsDto;

    const where = { receiverId: userId };

    const totalCount = await this.prisma.notification.count({ where });

    const notifications = await this.prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        room: { select: { id: true } },
      },
    });

    const data: NotificationItemDto[] = notifications.map((n: any) => {
      return {
        notificationId: n.id,
        type: n.type,
        message: this.getNotificationMessage(n),
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        metadata: {
          meetingId: n.meetingId ?? undefined,
          meetingTitle: n.meeting?.title ?? undefined,
          lessonId: n.lessonId ?? undefined,
          lessonTitle: n.lesson?.title ?? undefined,
          roomId: n.roomId ?? undefined,
        },
      };
    });

    const pageMetaDto = new PageMetaDto(totalCount, page, limit);
    return new PageDto(data, pageMetaDto);
  }

  /**
   * 알림 읽음 처리
   */
  async updateReadStatus(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.receiverId !== userId) {
      throw new InternalServerErrorException('알림을 찾을 수 없거나 접근 권한이 없습니다.');
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
