import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { plainToInstance } from 'class-transformer';
// Prisma import removed — controller shouldn't construct Prisma input directly

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  // POST /lessons : 클래스 생성
  @Post()
  async createLesson(@Body() dto: CreateLessonDto) {
    return this.lessonsService.createLesson(dto);
  }

  // PUT /lessons/:lessonId : 클래스 수정
  @Put(':lessonId')
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.updateLesson(lessonId, dto);
  }

  // DELETE /lessons/:lessonId : 클래스 삭제 (soft delete)

  //TODO : 클래스 상태 수정 API 추가

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
