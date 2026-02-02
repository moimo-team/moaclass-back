import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // DB 연결을 위해 PrismaModule을 가져옵니다.
  controllers: [LessonsController], // 외부의 요청을 받는 컨트롤러 등록
  providers: [LessonsService], // 비즈니스 로직을 수행하는 서비스 등록
  exports: [LessonsService], // 혹시 다른 모듈에서 LessonsService를 써야 한다면 내보내기
})
export class LessonsModule {}
