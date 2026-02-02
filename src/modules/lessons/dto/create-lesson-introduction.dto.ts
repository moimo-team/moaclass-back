import {
  IsString,
  MaxLength,
  IsInt,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Level } from '@prisma/client';

export class CreateLessonIntroductionDto {
  @IsString()
  @MaxLength(50)
  title: string;

  @Type(() => Number)
  @IsInt()
  categoryId: number; // 카테고리 대분류 ID

  @Type(() => Number)
  @IsInt()
  subCategoryId: number; // 카테고리 소분류 ID

  @IsString()
  thumbailImage: string; // 대표 이미지 URL

  @IsArray()
  @IsString({ each: true })
  classImages: string[]; // 나머지 이미지 URL 배열

  @IsString()
  @MaxLength(600)
  description: string; // 상세 내용

  @IsEnum(Level)
  level: Level; // 난이도 (BEGINNER, INTERMEDIATE, ADVANCED)

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration: number; // 기간 (분 단위)

  @IsString()
  curriculum: string; // 커리큘럼 내용
}
