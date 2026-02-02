import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { Level } from '@prisma/client';

export class CreateCurriculumDto {
  @IsEnum(Level)
  level: Level; // BEGINNER, INTERMEDIATE, ADVANCED

  @IsString()
  durationText: string; // 소요시간 (예: "2시간", "4주")

  @IsString()
  @MinLength(40)
  @MaxLength(600)
  curriculum: string;
}
