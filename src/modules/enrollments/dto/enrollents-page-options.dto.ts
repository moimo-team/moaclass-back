import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { IsOptional, IsIn } from 'class-validator';

export class EnrollmentPageOptionsDto extends PageOptionsDto {
  @IsOptional()
  @IsIn(['전체', '수강예정', '수강취소', '수강완료'])
  filter?: string = '전체';
}
