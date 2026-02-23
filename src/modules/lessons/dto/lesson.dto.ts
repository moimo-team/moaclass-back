import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayUnique,
  ArrayMinSize,
  ArrayMaxSize,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Level, LessonStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';

export class CreateLessonDto {
  @IsInt()
  @Type(() => Number)
  lessonCategoryId: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(Level)
  level: Level;

  @IsInt()
  @Type(() => Number)
  durationMin: number;

  @IsString()
  curriculum: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => Number(item));
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          return Array.isArray(parsed)
            ? parsed.map((item: unknown) => Number(item))
            : value;
        } catch {
          return value;
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map((item) => Number(item.trim()));
      }

      return [Number(trimmed)];
    }

    return value;
  })
  @IsNotEmpty({ each: true })
  subCategoryIds: number[];

  @IsEnum(LessonStatus)
  @IsOptional()
  status?: LessonStatus;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  discountRate?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  discountedPrice?: number;

  @IsInt()
  @Type(() => Number)
  maxParticipants: number;

  @IsInt()
  @Type(() => Number)
  regionId: number;

  @IsString()
  address: string;

  @IsString()
  detailAddress: string;

  @IsString()
  directionsText: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  reservationLeadDays?: number;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => Number(item));
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (!trimmed) return [];

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          return Array.isArray(parsed)
            ? parsed.map((item: unknown) => Number(item))
            : value;
        } catch {
          return value;
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map((item) => Number(item.trim()));
      }

      return [Number(trimmed)];
    }

    return value;
  })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4, { each: true })
  @IsNotEmpty({ each: true })
  @Type(() => Number)
  removeSequences?: number[];
}
