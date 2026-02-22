import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Put,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { LessonPageOptionsDto } from './dto/lesson-page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import multer from 'multer';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('representativeImage', { storage: multer.memoryStorage() }),
  )
  async createLesson(
    @Body() dto: CreateLessonDto,
    @Req() req: Request & { user: JwtPayload },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.lessonsService.createLesson(req.user.id, dto, file);
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
    FileInterceptor('representativeImage', { storage: multer.memoryStorage() }),
  )
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
    @Req() req: Request & { user: JwtPayload },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.lessonsService.updateLesson(
      req.user.id,
      Number(lessonId),
      dto,
      file,
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
