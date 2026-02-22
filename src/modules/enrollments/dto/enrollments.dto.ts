import { IsInt, IsOptional, IsNumber, IsString } from 'class-validator';
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
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  couponId?: number;

  @IsOptional()
  @IsString()
  email?: string;
}
