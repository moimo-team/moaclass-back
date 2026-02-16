import { NotificationType } from '@prisma/client';

export class NotificationItemDto {
  notificationId: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    meetingId?: number;
    meetingTitle?: string;
    lessonId?: number;
    lessonTitle?: string;
    roomId?: number;
  };

  // 기존 호환성을 위한 선택적 필드 (필요시 사용)
  meetingId?: number;
  meetingName?: string;
}
