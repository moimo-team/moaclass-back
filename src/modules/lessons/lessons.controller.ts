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
  async getLessons(@Query() filters: LessonPageOptionsDto) {
    return this.lessonsService.getLessons(filters);
  }

  @Get(':lessonId')
  async getLessonDetail(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getLessonDetail(Number(lessonId));
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
  async deleteLesson(@Param('lessonId') lessonId: string) {
    return this.lessonsService.softDeleteLesson(lessonId);
  }

  // PUT /lesson/schedules/:scheduleId : 일정 수정
  @Put('schedules/:scheduleId')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.lessonsService.updateSchedule(scheduleId, dto);
  }
  // POST /lessons/:lessonId/schedules : 일정 추가
  @Post(':lessonId/schedules')
  async addSchedule(@Param('lessonId') lessonId: string, @Body() body: any) {
    const dto = plainToInstance(CreateScheduleDto, body);
    return this.lessonsService.addSchedule(lessonId, dto);
  }
  // DELETE /lesson/schedules/:scheduleId : 일정 삭제
  @Delete('schedules/:scheduleId')
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    return this.lessonsService.deleteSchedule(scheduleId);
  }

  //   // POST /lessons/:lessonId/images : 갤러리 이미지 업로드
  //   @Post(':lessonId/images')
  //   @UseInterceptors(FileInterceptor('file'))
  //   async uploadImage(
  //     @Param('lessonId') lessonId: string,
  //     @UploadedFile() file: Express.Multer.File,
  //   ) {
  //     return this.lessonsService.uploadImage(lessonId, file);
  //   }

  //   // DELETE /lesson/images/:imageId : 갤러리 이미지 삭제
  //   @Delete('images/:imageId')
  //   async deleteImage(@Param('imageId') imageId: string) {
  //     return this.lessonsService.deleteImage(imageId);
  //   }
}
