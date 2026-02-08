import { IsString, IsInt, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Level, LessonStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class CreateLessonDto {
  @IsInt()
  @Type(() => Number)
  teacherId: number;

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
  @IsOptional()
  @Type(() => Number)
  maxParticipants?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  likes?: number;

  @IsInt()
  @Type(() => Number)
  regionId: number;

  @IsString()
  address: string;

  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @IsString()
  detailAddress: string;

  @IsString()
  directionsText: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  reservationLeadDays?: number;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
