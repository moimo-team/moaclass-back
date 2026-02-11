import { IsInt, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEnrollmentDto {
  @IsInt()
  @Type(() => Number)
  scheduleId: number; // 신청할 클래스 스케줄 ID

  @IsNumber()
  @Type(() => Number)
  paidAmount: number; // 결제 금액 (포인트/쿠폰 적용 후 최종 금액)

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  usePoints?: number; // 사용할 포인트 (선택)

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  couponId?: number; // 사용할 쿠폰 ID (선택)
}
