import { IsString, IsInt, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Level, LessonStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

export class CreateLessonDto {
  @IsInt()
  teacherId: number;

  @IsInt()
  lessonCategoryId: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(Level)
  level: Level;

  @IsInt()
  durationMin: number;

  @IsString()
  curriculum: string;

  @IsEnum(LessonStatus)
  @IsOptional()
  status?: LessonStatus;

  @IsInt()
  @IsOptional()
  price?: number;

  @IsInt()
  @IsOptional()
  discountRate?: number;

  @IsInt()
  @IsOptional()
  discountedPrice?: number;

  @IsInt()
  @IsOptional()
  maxParticipants?: number;

  @IsString()
  representativeImage: string;

  @IsInt()
  @IsOptional()
  likes?: number;

  @IsInt()
  regionId: number;

  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  detailAddress: string;

  @IsString()
  directionsText: string;

  @IsInt()
  @IsOptional()
  reservationLeadDays?: number;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
