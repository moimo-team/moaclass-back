import {
  IsDate,
  IsInt,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonScheduleStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
export class CreateScheduleDto {
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  currentParticipants?: number;

  @IsEnum(LessonScheduleStatus)
  @IsOptional()
  status?: LessonScheduleStatus;
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
