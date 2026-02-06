import { IsString, IsNotEmpty, MinLength, IsUrl, MaxLength } from 'class-validator';

export class CreateMomentoDto {
  @IsString()
  @IsNotEmpty({ message: '닉네임은 필수 항목입니다.' })
  nickname: string;

  @IsString()
  @IsNotEmpty({ message: '소개글은 필수 항목입니다.' })
  @MinLength(40, { message: '소개글은 최소 40자 이상이어야 합니다.' })
  @MaxLength(600, { message: '소개글은 최대 600자 이내여야 합니다.' })
  introduction: string;
}