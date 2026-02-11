import { Controller, Get, UseGuards, Req, Post, Body } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('me')
  async getMyPoints(@Req() req: Request & { user: JwtPayload }) {
    const userId = req.user.id;
    return await this.pointsService.getMyPoints(userId);
  }

  @Post('charge')
  async chargePoints(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { amount: number },
  ) {
    const userId = req.user.id;
    return this.pointsService.chargePoints(userId, body.amount);
  }
}
