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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { plainToInstance } from 'class-transformer';
import { LessonPageOptionsDto } from './dto/lesson-page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
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
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.lessonsService.createLesson(dto, file);
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
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.lessonsService.updateLesson(Number(lessonId), dto, file);
  }
  @Delete(':lessonId')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    return this.lessonsService.softDeleteLesson(lessonId);
  }

  @Put('schedules/:scheduleId')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.lessonsService.updateSchedule(scheduleId, dto);
  }
  @Post(':lessonId/schedules')
  async addSchedule(@Param('lessonId') lessonId: string, @Body() body: any) {
    const dto = plainToInstance(CreateScheduleDto, body);
    return this.lessonsService.addSchedule(lessonId, dto);
  }
  @Delete('schedules/:scheduleId')
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    return this.lessonsService.deleteSchedule(scheduleId);
  }
}
