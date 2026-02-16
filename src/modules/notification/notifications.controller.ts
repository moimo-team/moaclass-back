import { Controller, Get, Query, UseGuards, Req, Patch, Param, ParseIntPipe, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { NotificationItemDto } from './dto/notification-item.dto';
import { PageDto } from '../common/dto/page.dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() pageOptionsDto: GetNotificationsDto,
    @Req() req: RequestWithUser,
  ): Promise<PageDto<NotificationItemDto>> {
    return await this.notificationsService.getNotifications(
      req.user.id,
      pageOptionsDto,
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return await this.notificationsService.updateReadStatus(req.user.id, id);
  }

  /**
   * 알림 테스트를 위한 임시 엔드포인트
   * POST /notifications/test
   */
  @Post('test')
  @UseGuards(JwtAuthGuard)
  async sendTestNotification(
    @Req() req: RequestWithUser,
    @Body() body: { type: string; receiverId?: number }
  ) {
    return await this.notificationsService.createNotification({
      receiverId: body.receiverId || req.user.id,
      type: body.type || 'NEW_CHAT',
      senderId: req.user.id,
    });
  }
}
