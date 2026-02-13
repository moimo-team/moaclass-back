import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('preview')
  async getPaymentPreview(
    @Req() req: Request & { user: JwtPayload },
    @Query('scheduleId') scheduleId: number,
    @Query('quantity') quantity: number,
  ) {
    const userId = req.user.id;
    return this.paymentsService.getPaymentPreview(scheduleId, quantity, userId);
  }

  @Post('calculate')
  async calculateFinalPrice(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { scheduleId: number; quantity: number; couponId?: number },
  ) {
    const userId = req.user.id;

    const { scheduleId, quantity, couponId } = body;
    return this.paymentsService.calculateFinalPrice(
      userId,
      scheduleId,
      quantity,
      couponId,
    );
  }

  // 결제 상세 조회
  @Get('detail/:enrollmentId')
  async getPaymentDetail(
    @Req() req: Request & { user: JwtPayload },
    @Param('enrollmentId') enrollmentId: number,
  ) {
    const userId = req.user.id;
    return this.paymentsService.getPaymentDetail(enrollmentId, userId);
  }
}
