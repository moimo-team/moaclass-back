import {
  Controller,
  Post,
  Param,
  Body,
  ParseIntPipe,
  ParseArrayPipe,
  Req,
  Delete,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { LessonSchedulesService } from './lesson-schedules.service';
import { CreateScheduleDto } from './dto/schedule.dto';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonSchedulesController {
  constructor(private readonly schedulesService: LessonSchedulesService) {}

  @Post(':lessonId/schedules')
  async addSchedule(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body(new ParseArrayPipe({ items: CreateScheduleDto }))
    dtos: CreateScheduleDto[],
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.schedulesService.addSchedules(req.user.id, lessonId, dtos);
  }

  @Delete('schedules/:scheduleId')
  @HttpCode(204)
  async deleteSchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.schedulesService.deleteSchedule(req.user.id, scheduleId);
  }
}
