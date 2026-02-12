import {
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';
import { LessonScheduleStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
export class CreateScheduleDto {
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  startAt: string;

  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  endAt: string;
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
  @IsEnum(LessonScheduleStatus)
  @IsOptional()
  status?: LessonScheduleStatus;
}
