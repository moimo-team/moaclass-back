import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Level } from '@prisma/client';

export enum LessonSort {
  NEW = 'NEW', // 최신순
  UPDATE = 'UPDATE', // 업데이트순
  DEADLINE = 'DEADLINE', // 마감 임박순
  PRICE_ASC = 'PRICE_ASC', // 가격 오름차순
  PRICE_DESC = 'PRICE_DESC', // 가격 내림차순
  RATE = 'RATE', // 평점 높은순
  LIKES = 'LIKES', // 좋아요 많은순
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
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  days?: string[];

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
  @IsString()
  status?: string = 'all';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  finishedFilter?: boolean = false;
}
