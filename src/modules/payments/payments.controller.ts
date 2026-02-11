import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // 1. 결제 정보 조회 (Preview)
  @Get('preview')
  async getPaymentPreview(
    @Query('scheduleId') scheduleId: number,
    @Query('quantity') quantity: number,
  ) {
    return this.paymentsService.getPaymentPreview(scheduleId, quantity);
  }

  // 2. 최종 결제 금액 계산 (Calculate)
  @Post('calculate')
  async calculateFinalPrice(
    @Body() body: { scheduleId: number; quantity: number; couponId?: number },
  ) {
    const { scheduleId, quantity, couponId } = body;
    return this.paymentsService.calculateFinalPrice(
      scheduleId,
      quantity,
      couponId,
    );
  }
}
