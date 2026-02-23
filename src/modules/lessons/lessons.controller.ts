import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  Put,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { LessonPageOptionsDto } from './dto/lesson-page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import multer from 'multer';

type LessonUploadFiles = {
  image1?: Express.Multer.File[];
  image2?: Express.Multer.File[];
  image3?: Express.Multer.File[];
  image4?: Express.Multer.File[];
};

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'image3', maxCount: 1 },
        { name: 'image4', maxCount: 1 },
      ],
      { storage: multer.memoryStorage() },
    ),
  )
  async createLesson(
    @Body() dto: CreateLessonDto,
    @Req() req: Request & { user: JwtPayload },
    @UploadedFiles() files: LessonUploadFiles,
  ) {
    await this.lessonsService.createLesson(req.user.id, dto, files ?? {});
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getLessons(
    @Query() filters: LessonPageOptionsDto,
    @Req() req: Request & { user?: JwtPayload | null },
  ) {
    return this.lessonsService.getLessons(filters, req.user?.id);
  }

  @Get(':lessonId')
  @UseGuards(OptionalJwtAuthGuard)
  async getLessonDetail(
    @Param('lessonId') lessonId: string,
    @Req() req: Request & { user?: JwtPayload | null },
  ) {
    return this.lessonsService.getLessonDetail(Number(lessonId), req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':lessonId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'image3', maxCount: 1 },
        { name: 'image4', maxCount: 1 },
      ],
      { storage: multer.memoryStorage() },
    ),
  )
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
    @Req() req: Request & { user: JwtPayload },
    @UploadedFiles() files: LessonUploadFiles,
  ) {
    await this.lessonsService.updateLesson(
      req.user.id,
      Number(lessonId),
      dto,
      files ?? {},
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':lessonId')
  @HttpCode(204)
  async deleteLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.lessonsService.softDeleteLesson(req.user.id, lessonId);
  }
}
