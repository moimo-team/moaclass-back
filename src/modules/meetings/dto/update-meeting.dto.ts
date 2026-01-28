import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  interestId?: number;

  @IsOptional()
  @IsString()
  meetingDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  address?: string;
}
