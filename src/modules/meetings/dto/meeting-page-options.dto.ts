import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../common/dto/page-options.dto';

export enum MeetingSort {
  NEW = 'NEW',
  UPDATE = 'UPDATE',
  DEADLINE = 'DEADLINE',
}

export class MeetingPageOptionsDto extends PageOptionsDto {
  @IsOptional()
  @IsEnum(MeetingSort)
  sort?: MeetingSort = MeetingSort.NEW;

  @IsOptional()
  @IsString()
  interestFilter?: string = 'ALL';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  finishedFilter?: boolean = false;

  @IsOptional()
  @IsString()
  status?: string = 'all';
}
