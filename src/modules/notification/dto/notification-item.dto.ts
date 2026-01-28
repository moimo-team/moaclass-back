import { NotificationType } from '@prisma/client';

export class NotificationItemDto {
  notificationId: number;
  type: NotificationType;
  meetingId: number;
  meetingName: string;
  isRead: boolean;
  createdAt: string;
}
