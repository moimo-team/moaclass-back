import { Module } from '@nestjs/common';
import { MomentoesController } from './momentoes.controller';
import { MomentoesService } from './momentoes.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [MomentoesController],
  providers: [MomentoesService],
})
export class MomentoesModule {}
