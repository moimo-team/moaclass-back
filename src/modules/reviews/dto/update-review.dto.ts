import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => Number(item));
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          return Array.isArray(parsed)
            ? parsed.map((item: unknown) => Number(item))
            : value;
        } catch {
          return value;
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map((item) => Number(item.trim()));
      }

      return [Number(trimmed)];
    }

    return value;
  })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(8, { each: true })
  removeSequences?: number[];
}
