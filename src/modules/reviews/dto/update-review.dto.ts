import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function toBoolean({ value }: { value: unknown }) {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }

  return value;
}

export class UpdateReviewDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage1?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage2?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage3?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage4?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage5?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage6?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage7?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage8?: boolean;
}
