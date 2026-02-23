import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Level, LessonStatus } from '@prisma/client';

export enum LessonSort {
  LATEST = 'LATEST',
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
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }): number[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v));
    }
    return [Number(value)];
  })
  regionId?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }): number[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v));
    }
    return [Number(value)];
  })
  categoryId?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }): number[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v));
    }
    return [Number(value)];
  })
  subCategoryId?: number[];

  @IsOptional()
  @IsEnum(LessonSort)
  @Transform(({ value }): LessonSort => value ?? LessonSort.LATEST)
  sort?: LessonSort;

  @IsOptional()
  @IsArray()
  @IsEnum(Level, { each: true })
  @Transform(({ value }): Level[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalize = (v: string) => v.toUpperCase() as Level;
    if (Array.isArray(value)) {
      return value.map((v) => normalize(String(v)));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(normalize);
    }
    return [normalize(String(value))];
  })
  level?: Level[];

  @IsOptional()
  @IsEnum(LessonDay, { each: true })
  @Transform(({ value }): LessonDay[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalize = (v: string) => v.toUpperCase() as LessonDay;
    if (Array.isArray(value)) {
      return value.map((v) => normalize(String(v)));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(normalize);
    }
    return [normalize(String(value))];
  })
  days?: LessonDay[];

  @IsOptional()
  @IsNumber()
  @Transform(({ value }): number | undefined =>
    value ? Number(value) : undefined,
  )
  minParticipants?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }): number | undefined =>
    value ? Number(value) : undefined,
  )
  maxParticipants?: number;

  @IsOptional()
  @Matches(/^\d{1,2}-\d{1,2}$/)
  timeRange?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }): number | undefined =>
    value ? Number(value) : undefined,
  )
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }): number | undefined =>
    value ? Number(value) : undefined,
  )
  maxPrice?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(LessonStatus, { each: true })
  @Transform(({ value }): LessonStatus[] | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalize = (v: string) => v.toUpperCase() as LessonStatus;
    if (Array.isArray(value)) {
      return value.map((v) => normalize(String(v)));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(normalize);
    }
    return [normalize(String(value))];
  })
  status?: LessonStatus[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): boolean => value === 'true' || value === true)
  finishedFilter?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): boolean => value === 'true' || value === true)
  isLiked?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  userId?: number;
}
