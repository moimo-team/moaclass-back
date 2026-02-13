import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyCoupons(@Req() req: Request & { user: JwtPayload }) {
    const userId = req.user.id;
    return this.couponsService.getUserCoupons(Number(userId));
  }

  @Get(':id')
  async getCoupon(@Param('id') id: number) {
    return this.couponsService.getCoupon(Number(id));
  }

  @Get()
  async getAllCoupons() {
    return this.couponsService.getAllCoupons();
  }

  @Post()
  async createCoupon(
    @Body()
    body: {
      code: string;
      description?: string;
      discountType: 'FIXED' | 'PERCENT';
      discountValue: number;
      maxUsage: number;
      validFrom: Date;
      validUntil: Date;
    },
  ) {
    return this.couponsService.createCoupon(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('issue')
  async issueCoupon(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { userId: number; couponId: number },
  ) {
    try {
      return await this.couponsService.issueCoupon(body.userId, body.couponId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          error: {
            code: 'COUPON_ALREADY_ISSUED',
            message: error.message,
          },
        };
      }
      throw error;
    }
  }
}
