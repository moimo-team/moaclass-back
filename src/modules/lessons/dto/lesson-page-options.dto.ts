import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Level, LessonStatus } from '@prisma/client';

export enum LessonSort {
  NEW = 'NEW',
  UPDATE = 'UPDATE',
  DEADLINE = 'DEADLINE',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  RATE = 'RATE',
  LIKES = 'LIKES',
}

export enum LessonDay {
  WEEKDAY = 'WEEKDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export class LessonPageOptionsDto extends PageOptionsDto {
  @IsOptional()
  @IsEnum(LessonSort)
  @Transform(({ value }) => value ?? LessonSort.NEW)
  sort?: LessonSort;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  categoryId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  regionId?: number;

  @IsOptional()
  @IsString()
  level?: Level;

  @IsOptional()
  @IsEnum(LessonDay, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  days?: LessonDay[];

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  minParticipants?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  timeRange?: string; // "09:00-18:00"

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  maxPrice?: number;

  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  finishedFilter?: boolean = false;
}
