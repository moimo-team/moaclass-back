import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsDateString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  interestId: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  maxParticipants: number;

  @IsDateString()
  @IsNotEmpty()
  meetingDate: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}
