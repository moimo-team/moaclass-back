import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 전역 모듈로 선언하면 어디서든 import 없이 사용 가능
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
