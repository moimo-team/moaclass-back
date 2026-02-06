import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateMomentoDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(40)
  @MaxLength(600)
  @IsOptional()
  introduction?: string;
}