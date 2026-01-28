import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
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
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
