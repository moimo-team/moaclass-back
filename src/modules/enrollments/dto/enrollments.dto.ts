import { IsInt, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEnrollmentDto {
  @IsInt()
  @Type(() => Number)
  scheduleId: number;

  @IsNumber()
  @Type(() => Number)
  finalPrice: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  usePoints?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  couponId?: number;
}
