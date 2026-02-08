import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateLikeDto {
  @IsInt()
  @IsNotEmpty()
  lessonId: number;
}