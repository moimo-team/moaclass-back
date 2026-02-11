// import {
//   Controller,
//   Get,
//   Post,
//   UseGuards,
//   Req,
//   Body,
// } from '@nestjs/common';
// import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
// import { PointsService } from './app';

// @Controller('points')
// @UseGuards(JwtAuthGuard)
// export class PointsController {
//   constructor(private readonly pointsService: PointsService) {}

//   @Get('me')
//   async getMyPoints(@Req() req) {
//     const userId = req.user.id;
//     return this.pointsService.getMyPoints(userId);
//   }

//   @Post('charge')
//   async chargePoints(@Req() req, @Body() dto: ChargePointsDto) {
//     const userId = req.user.id;
//     return this.pointsService.chargePoints(userId, dto.amount);
//   }
// }
