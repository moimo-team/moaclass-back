import {
  IsString,
  IsOptional,
  IsArray,
  ArrayUnique,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateExtraInfoDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every((v) => Number.isInteger(v))) {
          return parsed as number[];
        }
        return [];
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  interests?: number[];

  @IsOptional()
  @IsString()
  image?: string;
}
