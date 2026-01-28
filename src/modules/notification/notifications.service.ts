import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NotificationItemDto } from './dto/notification-item.dto';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(
    userId: number,
    pageOptionsDto: GetNotificationsDto,
  ): Promise<PageDto<NotificationItemDto>> {
    const { page = 1, limit = 5 } = pageOptionsDto;

    const where = { receiverId: userId };

    const totalCount = await this.prisma.notification.count({ where });

    const notifications = await this.prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const data: NotificationItemDto[] = notifications.map((n) => {
      if (!n.meeting) {
        throw new InternalServerErrorException(
          `알림(ID: ${n.id})에 연결된 모임 정보가 없습니다.`,
        );
      }

      const kstDate = new Date(n.createdAt.getTime() + 9 * 60 * 60 * 1000);
      const formattedDate = kstDate.toISOString().split('.')[0];

      return {
        notificationId: n.id,
        type: n.type,
        meetingId: n.meeting.id,
        meetingName: n.meeting.title,
        isRead: n.isRead,
        createdAt: formattedDate,
      };
    });

    const pageMetaDto = new PageMetaDto(totalCount, page, limit);
    return new PageDto(data, pageMetaDto);
  }
}
