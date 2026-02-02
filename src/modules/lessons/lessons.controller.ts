import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonIntroductionDto } from './dto/create-lesson-introduction.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  // 클래스 소개 등록 API
  @Post('introduction')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'representativeImage', maxCount: 1 },
      { name: 'classImages', maxCount: 8 },
    ]),
  )
  async createIntroduction(
    @Body() dto: CreateLessonIntroductionDto,
    @UploadedFiles()
    files: {
      representativeImage?: Express.Multer.File[];
      classImages?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    try {
      // JWT 토큰에서 teacherId 추출
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const userId: number = req.user.id;

      // 파일 URL 배열로 변환 (실제 S3 업로드 로직 필요)
      const representativeImageUrl = files.representativeImage?.[0]?.filename;
      const classImageUrls =
        files.classImages?.map((file) => file.filename) || [];

      const result = await this.lessonsService.createIntroduction(
        dto,
        userId,
        representativeImageUrl,
        classImageUrls,
      );

      return { statusCode: HttpStatus.CREATED, data: result };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new HttpException(
        '클래스 등록에 실패했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
