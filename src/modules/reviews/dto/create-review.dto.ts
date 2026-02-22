import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  enrollmentId: number;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(5)
  rating: number;

  @IsString()
  content: string;
}
