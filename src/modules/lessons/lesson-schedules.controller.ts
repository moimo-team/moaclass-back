import {
  Controller,
  Post,
  //   Put,
  //   Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { LessonSchedulesService } from './lesson-schedules.service';
import { CreateScheduleDto } from './dto/schedule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // 경로 확인 필요
import { JwtPayload } from '../auth/jwt-payload.interface';
import * as express from 'express';

@Controller('lessons') // 라우팅 구조 유지를 위해 'lessons'로 시작
export class LessonSchedulesController {
  constructor(private readonly schedulesService: LessonSchedulesService) {}

  // POST /lessons/:lessonId/schedules : 일정 추가
  @Post(':lessonId/schedules')
  async addSchedule(
    @Param('lessonId', ParseIntPipe) lessonId: number, // ✅ ParseIntPipe로 타입 변환
    @Body() dto: CreateScheduleDto, // ✅ any 제거 및 DTO 적용
  ) {
    return this.schedulesService.addSchedule(lessonId, dto);
  }

  //   // PUT /lessons/schedules/:scheduleId : 일정 수정
  //   @Put('schedules/:scheduleId')
  //   async updateSchedule(
  //     @Param('scheduleId', ParseIntPipe) scheduleId: number,
  //     @Body() dto: UpdateScheduleDto,
  //   ) {
  //     return this.schedulesService.updateSchedule(scheduleId, dto);
  //   }

  //   // PUT /lesson/schedules/:scheduleId : 일정 수정
  //   @Put('schedules/:scheduleId')
  //   async updateSchedule(
  //     @Param('scheduleId') scheduleId: string,
  //     @Body() dto: UpdateScheduleDto,
  //   ) {
  //     return this.lessonsService.updateSchedule(scheduleId, dto);
  //   }

  //   // DELETE /lessons/schedules/:scheduleId : 일정 삭제
  //   @Delete('schedules/:scheduleId')
  //   async deleteSchedule(@Param('scheduleId', ParseIntPipe) scheduleId: number) {
  //     return this.schedulesService.deleteSchedule(scheduleId);
  //   }

  //   // DELETE /lesson/schedules/:scheduleId : 일정 삭제
  //   @Delete('schedules/:scheduleId')
  //   async deleteSchedule(@Param('scheduleId') scheduleId: string) {
  //     return this.lessonsService.deleteSchedule(scheduleId);
  //   }
}
