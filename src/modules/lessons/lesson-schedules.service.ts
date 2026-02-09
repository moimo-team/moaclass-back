import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LessonSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async addSchedule(lessonId: number, dto: CreateScheduleDto) {
    try {
      return await this.prisma.lessonSchedule.create({
        data: {
          lesson: { connect: { id: lessonId } },
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          status: dto.status,
          currentParticipants: dto.currentParticipants ?? 0,
        },
      });
    } catch {
      throw new InternalServerErrorException(
        '일정 추가 중 오류가 발생했습니다.',
      );
    }
  }

  async updateSchedule(scheduleId: number, dto: UpdateScheduleDto) {
    try {
      return await this.prisma.lessonSchedule.update({
        where: { id: scheduleId },
        data: {
          ...(dto.startAt && { startAt: new Date(dto.startAt) }),
          ...(dto.endAt && { endAt: new Date(dto.endAt) }),
          ...(dto.status && { status: dto.status }),
          ...(dto.currentParticipants !== undefined && {
            currentParticipants: dto.currentParticipants,
          }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('수정할 일정을 찾을 수 없습니다.');
      }
      throw new InternalServerErrorException(
        '일정 수정 중 오류가 발생했습니다.',
      );
    }
  }

  async deleteSchedule(scheduleId: number) {
    try {
      await this.prisma.lessonSchedule.delete({ where: { id: scheduleId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('삭제할 일정을 찾을 수 없습니다.');
      }
      throw new InternalServerErrorException(
        '일정 삭제 중 오류가 발생했습니다.',
      );
    }
  }
}
