import { IsOptional, IsString } from 'class-validator';
import { PageOptionsDto } from '../../common/dto/page-options.dto';

export class MyMeetingPageOptionsDto extends PageOptionsDto {
  @IsOptional()
  @IsString()
  status?: string = 'all';

  @IsOptional()
  @IsString()
  view: string = 'all';
}
