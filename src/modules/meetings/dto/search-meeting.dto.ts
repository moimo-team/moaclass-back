import { IsNotEmpty, IsString } from 'class-validator';
import { PageOptionsDto } from '../../common/dto/page-options.dto';

export class SearchMeetingDto extends PageOptionsDto {
  @IsString()
  @IsNotEmpty({ message: '검색어를 입력해주세요.' })
  keyword: string;
}
